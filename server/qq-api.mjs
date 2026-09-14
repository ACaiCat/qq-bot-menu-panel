/**
 * QQ 机器人开放平台 API 客户端。
 *
 * 凭证只在本进程内流转：access_token 由服务端获取并缓存，浏览器永远拿不到 AppSecret。
 * 参考文档：
 *   - 调用指南      https://bot.q.qq.com/wiki/develop/api-v2/dev-prepare/api-call-guide.html
 *   - 获取访问凭证  https://bot.q.qq.com/wiki/develop/api-v2/dev-prepare/access-token.html
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 开放平台统一请求地址 */
export const API_BASE = 'https://api.bot.qq.com'

/** 文档中标注的默认凭证有效期（秒） */
const DEFAULT_TOKEN_TTL = 7200

/** 提前刷新阈值：剩余不足该秒数就重新获取 */
const REFRESH_MARGIN = 60

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CREDENTIALS_FILE = path.join(ROOT, '.qqbot.local.json')

// .env.local 作为兜底配置来源（该文件已被 .gitignore 忽略）。
try {
  process.loadEnvFile(path.join(ROOT, '.env.local'))
} catch {
  // 未提供 .env.local 时静默忽略
}

/**
 * 携带 QQ 业务错误码的异常。
 * @property {number|string|undefined} errCode
 * @property {number|undefined} status
 * @property {string|undefined} traceId
 */
export class QqApiError extends Error {
  constructor(message, { errCode, status, traceId, data } = {}) {
    super(message)
    this.name = 'QqApiError'
    this.errCode = errCode
    this.status = status
    this.traceId = traceId
    this.data = data
  }
}

/** 常见业务错误码的排查提示 */
export const ERROR_HINTS = {
  100001: '请求过于频繁，请稍后重试',
  100007: 'AppID 无效或机器人状态异常',
  100016: 'AppID 或 AppSecret 不正确',
  10004: '机器人不存在',
  40030001: '参数错误，请检查请求参数',
  40030006: '指令面板不存在，请确认 panel_id 是否正确',
  40030008: 'URL 格式错误，链接必须以 https:// 开头',
  40030009: '指令面板操作进行中，请稍后重试',
  40030011: '生效场景不合法，仅支持 c2c / group / channel / dm',
  40030012: '生效范围不合法，channel / dm 场景仅支持 all',
  40030013: '超出数量限制，请减少配置数量',
  40030014: '菜单类型不合法，仅支持 switch / send_message / link / menu',
  40030015: '面板元素类型不合法，仅支持 command / link',
  40030016: '必填字段缺失',
  40030017: '操作类型不合法，op 仅支持 add / del',
  40030018: '当前场景不支持此操作',
  40030020: '内容存在安全风险，请修改后重试',
  40030021: '全局面板不支持添加指定关联对象',
}

/** @type {{ appId: string, secret: string, source: string } | null} */
let overriddenCredentials = null
/** @type {string | null} */
let cachedToken = null
/** @type {number} */
let tokenExpiresAt = 0
/** @type {Promise<string> | null} */
let inflightToken = null

/** @returns {{ appId: string, secret: string, source: string } | null} */
export function getCredentials() {
  if (overriddenCredentials) return { ...overriddenCredentials, source: 'ui' }

  try {
    const parsed = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf8'))
    if (parsed?.appId && parsed?.secret) {
      return { appId: String(parsed.appId), secret: String(parsed.secret), source: 'file' }
    }
  } catch {
    // 文件不存在或内容损坏，继续尝试环境变量
  }

  const { QQ_BOT_APPID: appId, QQ_BOT_SECRET: secret } = process.env
  if (appId && secret) return { appId, secret, source: 'env' }

  return null
}

/**
 * 校验并保存凭证；保存前会先换取一次 access_token 以确认凭证可用。
 * @param {string} appId
 * @param {string} secret
 */
export async function saveCredentials(appId, secret) {
  await fetchAccessToken(appId, secret)
  fs.writeFileSync(CREDENTIALS_FILE, `${JSON.stringify({ appId, secret }, null, 2)}\n`, 'utf8')
  overriddenCredentials = { appId, secret }
  resetToken()
}

export function clearCredentials() {
  try {
    fs.unlinkSync(CREDENTIALS_FILE)
  } catch {
    // 文件本来就不存在
  }
  overriddenCredentials = null
  resetToken()
}

function resetToken() {
  cachedToken = null
  tokenExpiresAt = 0
}

/**
 * 调用 `/app/getAppAccessToken` 换取凭证。
 * @param {string} appId
 * @param {string} secret
 * @returns {Promise<{ accessToken: string, expiresIn: number }>}
 */
export async function fetchAccessToken(appId, secret) {
  let response
  try {
    response = await fetch(`${API_BASE}/app/getAppAccessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, clientSecret: secret }),
    })
  } catch (cause) {
    throw new QqApiError(`无法连接开放平台：${/** @type {Error} */ (cause).message}`, {
      status: 502,
    })
  }

  const payload = await readJson(response)
  const accessToken = payload?.access_token
  if (!accessToken) {
    const errCode = payload?.code ?? payload?.err_code
    throw new QqApiError(payload?.message || `获取 access_token 失败（HTTP ${response.status}）`, {
      errCode,
      status: response.ok ? 401 : response.status,
      data: payload,
    })
  }

  return {
    accessToken: String(accessToken),
    // 文档示例把 expires_in 写成字符串，这里统一转成数字
    expiresIn: Number(payload.expires_in) || DEFAULT_TOKEN_TTL,
  }
}

/**
 * 取缓存中的 access_token，临近过期时自动刷新。
 * @returns {Promise<string>}
 */
export async function getAccessToken() {
  if (cachedToken && tokenExpiresAt - Date.now() > REFRESH_MARGIN * 1000) return cachedToken
  if (inflightToken) return inflightToken

  const credentials = getCredentials()
  if (!credentials) {
    throw new QqApiError('尚未配置 AppID / AppSecret，请先在「设置」中填写', {
      errCode: 'NO_CREDENTIALS',
      status: 401,
    })
  }

  inflightToken = fetchAccessToken(credentials.appId, credentials.secret)
    .then(({ accessToken, expiresIn }) => {
      cachedToken = accessToken
      tokenExpiresAt = Date.now() + expiresIn * 1000
      return accessToken
    })
    .finally(() => {
      inflightToken = null
    })

  return inflightToken
}

/** 供状态接口展示的凭证信息（不含任何密文） */
export function describeCredentials() {
  const credentials = getCredentials()
  const expiresIn = cachedToken ? Math.round((tokenExpiresAt - Date.now()) / 1000) : 0
  return {
    configured: Boolean(credentials),
    appId: credentials ? credentials.appId : null,
    source: credentials ? credentials.source : null,
    token: { valid: expiresIn > 0, expiresIn: Math.max(0, expiresIn) },
  }
}

/**
 * 调用开放平台接口。
 * @param {string} method
 * @param {string} apiPath 形如 `/v2/menu`
 * @param {{ body?: unknown, query?: Record<string, string|number|undefined> }} [options]
 */
export async function callApi(method, apiPath, options = {}) {
  if (!apiPath.startsWith('/') || apiPath.includes('://')) {
    throw new QqApiError(`非法的接口路径：${apiPath}`, { status: 400 })
  }

  const token = await getAccessToken()
  const url = new URL(apiPath, API_BASE)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  }

  /** @type {RequestInit} */
  const init = {
    method,
    headers: {
      Authorization: `QQBot ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
    },
  }
  // GET / DELETE 不带请求体，其余方法按需序列化
  if (options.body !== undefined) init.body = JSON.stringify(options.body)

  let response
  try {
    response = await fetch(url, init)
  } catch (cause) {
    throw new QqApiError(`无法连接开放平台：${/** @type {Error} */ (cause).message}`, {
      status: 502,
    })
  }

  const payload = await readJson(response)
  const errCode = payload && typeof payload === 'object' ? (payload.err_code ?? payload.code) : 0
  const traceId = response.headers.get('x-tps-trace-id') ?? payload?.trace_id ?? null
  // 文档提示：不要依赖 message 判断成败，以 err_code 为准（成功时为 0 / 缺省）
  const ok = response.ok && !errCode
  const message = ok
    ? 'ok'
    : payload?.message || ERROR_HINTS[errCode] || `请求失败（HTTP ${response.status}）`

  return {
    ok,
    status: response.status,
    data: payload,
    errCode: errCode || undefined,
    message,
    traceId,
  }
}

async function readJson(response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}
