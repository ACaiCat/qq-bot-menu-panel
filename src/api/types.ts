/** 自定义菜单与指令面板的数据结构，字段命名与开放平台文档保持一致。 */

export type MenuItemType = 'switch' | 'send_message' | 'link' | 'menu'
export type SubMenuItemType = 'send_message' | 'link'
export type PanelItemType = 'command' | 'link'
/** c2c 单聊 / group 群聊 / channel 文字子频道 / dm 频道私信 */
export type Scope = 'c2c' | 'group' | 'channel' | 'dm'
/** all 全局生效 / specific 指定用户或群生效 */
export type TargetType = 'all' | 'specific'
export type TargetOp = 'add' | 'del'

export interface MenuSwitch {
  switch_id: string
  default: boolean
}

export interface SubMenuItem {
  name: string
  type: SubMenuItemType
  send_message?: string
  link?: string
}

export interface MenuItem {
  name: string
  type: MenuItemType
  sub_menu_items?: SubMenuItem[]
  send_message?: string
  link?: string
  switch?: MenuSwitch
}

export interface Menu {
  items: MenuItem[]
}

export interface MenuResponse {
  version?: number
  menu?: Menu | null
}

export interface PanelItem {
  name: string
  desc?: string
  type: PanelItemType
  only_admin?: boolean
  link?: string
}

export interface Panel {
  items: PanelItem[]
  remark?: string
  version?: number
}

export interface PanelRecord {
  panel_id: string
  scope: Scope
  target_type: TargetType
  panel: Panel
  created_at?: string
  updated_at?: string
  version?: number
  /** 仅 c2c + specific 时返回 */
  user_openids?: string[]
  /** 仅 group + specific 时返回 */
  group_openids?: string[]
}

export interface PanelListResponse {
  records: PanelRecord[]
  next_cursor?: string
  is_end?: boolean
}

export interface CreatePanelPayload {
  scope: Scope
  target_type: TargetType
  user_openids?: string[]
  group_openids?: string[]
  panel: Panel
}

export interface PanelTargetPayload {
  op: TargetOp
  user_openids?: string[]
  group_openids?: string[]
}

/** 后端统一响应信封 */
export interface Envelope<T> {
  ok: boolean
  status?: number
  data: T
  errCode?: number | string
  message?: string
  traceId?: string | null
}

export type CredentialSource = 'ui' | 'file' | 'env'

export interface ConnectionStatus {
  configured: boolean
  appId: string | null
  source: CredentialSource | null
  token: { valid: boolean; expiresIn: number }
}
