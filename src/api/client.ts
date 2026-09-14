import type {
  ConnectionStatus,
  CreatePanelPayload,
  Envelope,
  Menu,
  MenuResponse,
  Panel,
  PanelListResponse,
  PanelRecord,
  PanelTargetPayload,
  Scope,
} from './types'

/** 带 QQ 业务错误码的请求异常，便于界面展示 err_code / trace_id 排查。 */
export class ApiError extends Error {
  errCode?: number | string
  traceId?: string | null
  status?: number
  data?: unknown

  constructor(
    message: string,
    options: {
      errCode?: number | string
      traceId?: string | null
      status?: number
      data?: unknown
    } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.errCode = options.errCode
    this.traceId = options.traceId
    this.status = options.status
    this.data = options.data
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, init)
  } catch (cause) {
    throw new ApiError(`无法连接本地服务：${(cause as Error).message}`)
  }

  let envelope: Envelope<T> | null = null
  try {
    envelope = (await response.json()) as Envelope<T>
  } catch {
    throw new ApiError(`服务端返回了非 JSON 响应（HTTP ${response.status}）`, {
      status: response.status,
    })
  }

  if (!envelope?.ok) {
    throw new ApiError(envelope?.message || `请求失败（HTTP ${response.status}）`, {
      errCode: envelope?.errCode,
      traceId: envelope?.traceId,
      status: envelope?.status ?? response.status,
      data: envelope?.data,
    })
  }

  return envelope.data
}

function jsonRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

/** QQ 接口经由本地后端透传，路径中的 `/api/qq` 前缀会被后端剥掉。 */
function qq<T>(path: string, init?: RequestInit): Promise<T> {
  return request<T>(`/api/qq${path}`, init)
}

export const api = {
  status: () => request<ConnectionStatus>('/api/status'),

  saveCredentials: (appId: string, secret: string) =>
    jsonRequest<ConnectionStatus>('/api/credentials', 'POST', { appId, secret }),

  clearCredentials: () => request<ConnectionStatus>('/api/credentials', { method: 'DELETE' }),

  // ---- 自定义菜单（仅单聊生效，全局唯一） ----
  getMenu: () => qq<MenuResponse>('/v2/menu'),
  putMenu: (menu: Menu) => jsonRequest<{ version: number }>('/api/qq/v2/menu', 'PUT', { menu }),

  // ---- 指令面板 ----
  listPanels: (scope: Scope, cursor?: string) => {
    const query = new URLSearchParams({ scope })
    if (cursor) query.set('cursor', cursor)
    return qq<PanelListResponse>(`/v2/panels?${query.toString()}`)
  },
  getPanel: (panelId: string) => qq<PanelRecord>(`/v2/panels/${encodeURIComponent(panelId)}`),
  createPanel: (payload: CreatePanelPayload) =>
    jsonRequest<{ panel_id: string }>('/api/qq/v2/panels', 'POST', payload),
  updatePanel: (panelId: string, panel: Panel) =>
    jsonRequest<{ version: number }>(`/api/qq/v2/panels/${encodeURIComponent(panelId)}`, 'PUT', {
      panel,
    }),
  deletePanel: (panelId: string) =>
    qq<Record<string, never>>(`/v2/panels/${encodeURIComponent(panelId)}`, { method: 'DELETE' }),
  updatePanelTarget: (panelId: string, payload: PanelTargetPayload) =>
    jsonRequest<Record<string, never>>(
      `/api/qq/v2/panels/${encodeURIComponent(panelId)}/target`,
      'PUT',
      payload,
    ),
}
