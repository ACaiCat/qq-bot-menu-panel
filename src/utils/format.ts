/**
 * 统计“字符数”。开放平台的计数规则里 1 个中文（以及任何非 ASCII 字符）算 2 个字符。
 */
export function countUnits(text: string): number {
  let total = 0
  for (const char of text) {
    total += (char.codePointAt(0) ?? 0) > 0x7f ? 2 : 1
  }
  return total
}

/** 把 RFC3339 时间格式化为本地可读文本 */
export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** 把秒数格式化为 `1 小时 5 分` 这样的可读文本 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '已过期'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours} 小时 ${minutes} 分`
  if (minutes > 0) return `${minutes} 分 ${seconds % 60} 秒`
  return `${seconds} 秒`
}

/** 生成短随机串，用于开关标识等默认值 */
export function randomSuffix(length = 4): string {
  return Math.random()
    .toString(36)
    .slice(2, 2 + length)
}

/** 深拷贝，编辑器用它保存草稿，避免直接改动已加载的数据 */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}
