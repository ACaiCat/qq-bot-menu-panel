import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

import { createApiMiddleware } from './server/api-middleware.mjs'

/**
 * 把本地后端挂到 dev / preview 服务器上，使 AppSecret 与 access_token 只存在于 Node 进程内。
 * 生产环境由 `node server/index.mjs` 提供同样的接口。
 */
function qqBotApi() {
  return {
    name: 'qq-bot-api',
    configureServer(server: { middlewares: { use: (handler: unknown) => void } }) {
      server.middlewares.use(createApiMiddleware())
    },
    configurePreviewServer(server: { middlewares: { use: (handler: unknown) => void } }) {
      server.middlewares.use(createApiMiddleware())
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), vueJsx(), tailwindcss(), vueDevTools(), qqBotApi()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
