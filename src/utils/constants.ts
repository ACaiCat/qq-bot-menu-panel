import type { MenuItemType, PanelItemType, Scope, TargetType } from '@/api/types'

/** 文档中出现的各类数量上限 */
export const LIMITS = {
  /** 一级菜单最多 10 个 */
  menuItems: 10,
  /** 菜单名称：最多 10 个字符（1 个中文按 2 个字符计） */
  menuItemName: 10,
  /** 子菜单最多 5 个，且不支持再嵌套 */
  subMenuItems: 5,
  /** 子菜单名称：最多 14 个字符 */
  subMenuItemName: 14,
  /** 一个指令面板最多配置 20 个面板元素 */
  panelItems: 20,
  /** 面板元素名称：最多 14 个字符 */
  panelItemName: 14,
  /** 面板元素描述：最多 30 个字符 */
  panelItemDesc: 30,
  /** 备注最多 255 个字符，不对用户展示 */
  panelRemark: 255,
  /** 一个机器人最多创建 20 个指令面板 */
  panelCount: 20,
  /** 关联对象一次最多 20 个 */
  targetOpenids: 20,
} as const

export const MENU_TYPE_LABELS: Record<MenuItemType, string> = {
  switch: '开关',
  send_message: '发送消息',
  link: '链接跳转',
  menu: '子菜单',
}

/** 类型对应的图标名，见 AppIcon */
export const MENU_TYPE_ICONS: Record<MenuItemType, string> = {
  switch: 'toggle',
  send_message: 'message',
  link: 'link',
  menu: 'folder',
}

export const MENU_TYPE_HINTS: Record<MenuItemType, string> = {
  switch: '点击切换开关状态，状态变化会在消息的 ext 中携带',
  send_message: '点击后把内容填入输入框，由用户确认发送',
  link: '点击后跳转到指定网页，必须以 https:// 开头',
  menu: '折叠项，展开后显示最多 5 个子菜单',
}

export const SUB_MENU_TYPES: { value: 'send_message' | 'link'; label: string; icon: string }[] = [
  { value: 'send_message', label: '发送消息', icon: 'message' },
  { value: 'link', label: '链接跳转', icon: 'link' },
]

export const PANEL_TYPE_LABELS: Record<PanelItemType, string> = {
  command: '指令',
  link: '链接跳转',
}

export const PANEL_TYPE_ICONS: Record<PanelItemType, string> = {
  command: 'terminal',
  link: 'link',
}

export const PANEL_TYPE_HINTS: Record<PanelItemType, string> = {
  command: '点击后把名称填入输入框，由用户确认发送',
  link: '点击后在浏览器中打开链接',
}

export const SCOPE_LABELS: Record<Scope, string> = {
  c2c: '单聊',
  group: '群聊',
  channel: '文字子频道',
  dm: '频道私信',
}

export const SCOPE_ICONS: Record<Scope, string> = {
  c2c: 'user',
  group: 'users',
  channel: 'radio',
  dm: 'globe',
}

export const SCOPE_HINTS: Record<Scope, string> = {
  c2c: '用户与机器人的一对一会话',
  group: '机器人所在的群聊',
  channel: '频道下的文字子频道',
  dm: '频道内的私信会话',
}

/** 仅 c2c / group 支持指定对象生效 */
export const SCOPES_SUPPORTING_TARGET: Scope[] = ['c2c', 'group']

export const TARGET_TYPE_LABELS: Record<TargetType, string> = {
  all: '全部',
  specific: '指定对象',
}

export const TARGET_TYPE_ICONS: Record<TargetType, string> = {
  all: 'globe',
  specific: 'users',
}

export const ALL_SCOPES: Scope[] = ['c2c', 'group', 'channel', 'dm']
