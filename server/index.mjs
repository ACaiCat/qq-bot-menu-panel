/**
 * 生产环境服务器：提供 dist/ 静态资源 + /api 接口。
 *
 *   pnpm build && node server/index.mjs
 *
 * 环境变量：PORT（默认 4173）、HOST（默认 127.0.0.1）。
 */
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createApiMiddleware } from './api-middleware.mjs'
import { describeCredentials } from './qq-api.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const PORT = Number(process.env.PORT) || 4173
const HOST = process.env.HOST || '127.0.0.1'

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

if (!fs.existsSync(DIST)) {
  console.error('未找到 dist/，请先执行 `pnpm build`。')
  process.exit(1)
}

const api = createApiMiddleware()

const server = http.createServer((req, res) => {
  api(req, res, () => serveStatic(req, res))
})

server.listen(PORT, HOST, () => {
  const { appId, token } = describeCredentials()
  console.log(`QQ 机器人菜单面板 WebUI  →  http://${HOST}:${PORT}`)
  console.log(
    appId
      ? `已配置 AppID ${appId}${token.valid ? `（access_token 剩余 ${token.expiresIn}s）` : ''}`
      : '尚未配置 AppID / AppSecret，请在页面「设置」中填写。',
  )
})

function serveStatic(req, res) {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const relative = decodeURIComponent(url.pathname)
  const filePath = path.join(DIST, path.normalize(relative))

  // 阻断 `..` 穿越到 dist 之外的路径
  if (!filePath.startsWith(DIST)) return notFound(res)

  fs.stat(filePath, (error, stats) => {
    if (!error && stats.isFile()) return sendFile(res, filePath)
    // SPA 兜底：未命中的路径统一返回 index.html
    sendFile(res, path.join(DIST, 'index.html'))
  })
}

function sendFile(res, filePath) {
  const stream = fs.createReadStream(filePath)
  stream.on('error', () => notFound(res))
  res.writeHead(200, {
    'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream',
  })
  stream.pipe(res)
}

function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end('404 Not Found')
}
