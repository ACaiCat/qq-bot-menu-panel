import { reactive } from 'vue'

import { ApiError } from '@/api/client'

export type ToastType = 'success' | 'error' | 'info'

export interface Toast {
  id: number
  type: ToastType
  title: string
  detail?: string
}

/** 全局共享的提示队列 */
const items = reactive<Toast[]>([])
let sequence = 0

function push(type: ToastType, title: string, detail?: string) {
  const id = ++sequence
  items.push({ id, type, title, detail })
  window.setTimeout(() => dismiss(id), type === 'error' ? 9000 : 4000)
  return id
}

export function dismiss(id: number) {
  const index = items.findIndex((item) => item.id === id)
  if (index !== -1) items.splice(index, 1)
}

/**
 * 把异常转成可展示的文案。QQ 的业务错误码和 trace_id 一并带上，
 * 方便按文档排查或向开放平台反馈。
 */
export function describeError(error: unknown): { title: string; detail?: string } {
  if (error instanceof ApiError) {
    const parts: string[] = []
    if (error.errCode !== undefined && error.errCode !== null)
      parts.push(`err_code: ${error.errCode}`)
    if (error.traceId) parts.push(`trace_id: ${error.traceId}`)
    return { title: error.message, detail: parts.length > 0 ? parts.join(' · ') : undefined }
  }
  return { title: error instanceof Error ? error.message : String(error) }
}

export function useToast() {
  return {
    items,
    dismiss,
    success: (title: string, detail?: string) => push('success', title, detail),
    info: (title: string, detail?: string) => push('info', title, detail),
    error: (title: string, detail?: string) => push('error', title, detail),
    /** 直接把捕获到的异常弹出来 */
    failure: (error: unknown) => {
      const { title, detail } = describeError(error)
      push('error', title, detail)
    },
  }
}
