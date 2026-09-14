import { reactive } from 'vue'

import { api } from '@/api/client'
import type { ConnectionStatus } from '@/api/types'

/** 连接状态是全局共享的：侧边栏徽标和「设置」页读的是同一份数据。 */
const state = reactive({
  status: null as ConnectionStatus | null,
  loading: false,
  saving: false,
  loaded: false,
})

async function refresh() {
  state.loading = true
  try {
    state.status = await api.status()
  } finally {
    state.loading = false
    state.loaded = true
  }
}

async function save(appId: string, secret: string) {
  state.saving = true
  try {
    state.status = await api.saveCredentials(appId, secret)
    return state.status
  } finally {
    state.saving = false
  }
}

async function clear() {
  state.saving = true
  try {
    state.status = await api.clearCredentials()
    return state.status
  } finally {
    state.saving = false
  }
}

export function useConnection() {
  return { state, refresh, save, clear }
}
