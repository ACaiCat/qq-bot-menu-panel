/**
 * WebUI 的本地后端（connect 风格中间件，同时被 Vite dev server 与生产服务器复用）。
 *
 * 路由：
 *   GET    /api/status        连接状态（AppID、access_token 剩余有效期）
 *   POST   /api/credentials   保存并校验 AppID / AppSecret
 *   DELETE /api/credentials   清除本地凭证
 *   ANY    /api/qq/<path>     透传到 https://api.bot.qq.com/<path>
 */
import {
  QqApiError,
  callApi,
  clearCredentials,
  describeCredentials,
  getCredentials,
  saveCredentials,
} from './qq-api.mjs'

const MAX_BODY_BYTES = 1024 * 1024

/** 允许访问的来源主机名（本地工具，避免被任意网页调用） */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

/**
 * 创建 API 中间件。未命中 `/api/` 前缀的请求会交给下一个中间件。
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: (err?: unknown) => void) => void}
 */
export function createApiMiddleware() {
  return function apiMiddleware(req, res, next) {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    if (!url.pathname.startsWith('/api/')) return next()

    handle(req, res, url).catch((error) => {
      const status = error instanceof QqApiError && error.status ? error.status : 500
      if (status === 500) console.error('[api]', error)
      sendEnvelope(res, status, {
        ok: false,
        errCode: error instanceof QqApiError ? error.errCode : undefined,
        message: error instanceof Error ? error.message : '服务端异常',
        traceId: error instanceof QqApiError ? error.traceId : undefined,
        data: error instanceof QqApiError ? error.data : undefined,
      })
    })
  }
}

async function handle(req, res, url) {
  if (!isLocalRequest(req)) {
    throw new QqApiError('该接口仅允许本机访问', { status: 403 })
  }

  const { pathname } = url

  if (pathname === '/api/status' && req.method === 'GET') {
    return sendEnvelope(res, 200, { ok: true, data: describeCredentials() })
  }

  if (pathname === '/api/credentials') {
    if (req.method === 'POST') return handleSaveCredentials(req, res)
    if (req.method === 'DELETE') {
      clearCredentials()
      return sendEnvelope(res, 200, { ok: true, data: describeCredentials() })
    }
    throw new QqApiError(`不支持的请求方法 ${req.method}`, { status: 405 })
  }

  if (pathname.startsWith('/api/qq/')) return handleProxy(req, res, url)

  throw new QqApiError(`未知接口 ${req.method} ${pathname}`, { status: 404 })
}

async function handleSaveCredentials(req, res) {
  const body = await readJsonBody(req)
  const appId = typeof body?.appId === 'string' ? body.appId.trim() : ''
  const secret = typeof body?.secret === 'string' ? body.secret.trim() : ''
  if (!appId || !secret) {
    throw new QqApiError('AppID 与 AppSecret 均为必填', { status: 400 })
  }

  await saveCredentials(appId, secret)
  sendEnvelope(res, 200, { ok: true, data: describeCredentials() })
}

async function handleProxy(req, res, url) {
  // /api/qq/v2/menu -> /v2/menu
  const apiPath = url.pathname.slice('/api/qq'.length)
  const body = req.method === 'GET' || req.method === 'DELETE' ? undefined : await readJsonBody(req)
  const query = Object.fromEntries(url.searchParams)

  const result = await callApi(req.method ?? 'GET', apiPath, { body, query })
  sendEnvelope(res, result.ok ? 200 : result.status, result)
}

/**
 * 只接受来自本机的请求：校验 Host，并在浏览器带上 Origin 时一并校验。
 * @param {import('node:http').IncomingMessage} req
 */
function isLocalRequest(req) {
  const host = req.headers.host
  if (host && !LOCAL_HOSTS.has(stripPort(host))) return false

  const origin = req.headers.origin
  if (origin) {
    try {
      if (!LOCAL_HOSTS.has(stripPort(new URL(origin).host))) return false
    } catch {
      return false
    }
  }
  return true
}

function stripPort(host) {
  const withoutBrackets = host.startsWith('[') ? host.slice(0, host.indexOf(']') + 1) : host
  const colon = withoutBrackets.indexOf(':')
  return colon === -1 ? withoutBrackets : withoutBrackets.slice(0, colon)
}

/**
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<any>}
 */
async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new QqApiError('请求体过大', { status: 413 })
    chunks.push(chunk)
  }
  if (chunks.length === 0) return undefined

  const raw = Buffer.concat(chunks).toString('utf8').trim()
  if (!raw) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    throw new QqApiError('请求体不是合法的 JSON', { status: 400 })
  }
}

function sendEnvelope(res, status, envelope) {
  if (res.headersSent) return
  const body = JSON.stringify(envelope)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(body)
}

export { getCredentials }
