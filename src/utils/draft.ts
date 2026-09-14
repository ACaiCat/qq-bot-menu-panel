/**
 * 编辑器草稿模型。
 *
 * 开放平台的字段是「按 type 生效」的，例如 `link` 仅在 `type=link` 时有意义，
 * 因此返回结构里都是可选的。直接拿它做表单会让模板里到处是可选链。
 * 这里统一转成字段齐全的草稿类型，保存时再由 `normalize*` 裁回接口需要的形状。
 */
import type {
  Menu,
  MenuItem,
  MenuItemType,
  MenuSwitch,
  Panel,
  PanelItem,
  PanelItemType,
  PanelRecord,
  SubMenuItem,
  SubMenuItemType,
} from '@/api/types'

import { LIMITS } from './constants'
import { countUnits, randomSuffix } from './format'

export interface SubMenuItemDraft {
  name: string
  type: SubMenuItemType
  send_message: string
  link: string
}

export interface MenuItemDraft {
  /** 仅用于列表渲染的稳定标识；不会进入请求体 */
  key: string
  name: string
  type: MenuItemType
  send_message: string
  link: string
  switch: MenuSwitch
  sub_menu_items: SubMenuItemDraft[]
}

export interface MenuDraft {
  items: MenuItemDraft[]
}

export interface PanelItemDraft {
  /** 仅用于列表渲染的稳定标识；不会进入请求体 */
  key: string
  name: string
  desc: string
  type: PanelItemType
  only_admin: boolean
  link: string
}

export interface PanelDraft {
  items: PanelItemDraft[]
  remark: string
}

/** 校验问题；path 与草稿的数据路径对应，例如 `items.0.name` */
export interface Issue {
  path: string
  message: string
}

const HTTPS = /^https:\/\//i

// ---------------------------------------------------------------- 工厂

export function createSubMenuItemDraft(type: SubMenuItemType = 'send_message'): SubMenuItemDraft {
  return { name: '', type, send_message: '', link: 'https://' }
}

export function createMenuItemDraft(type: MenuItemType = 'send_message'): MenuItemDraft {
  const subMenuItems = type === 'menu' ? [createSubMenuItemDraft()] : []
  return {
    key: `item_${randomSuffix()}`,
    name: '',
    type,
    send_message: '',
    link: 'https://',
    switch: { switch_id: `switch_${randomSuffix()}`, default: false },
    sub_menu_items: subMenuItems,
  }
}

export function createPanelItemDraft(type: PanelItemType = 'command'): PanelItemDraft {
  return {
    key: `item_${randomSuffix()}`,
    name: '',
    desc: '',
    type,
    only_admin: false,
    link: 'https://',
  }
}

// ---------------------------------------------------------------- 接口 → 草稿

function toSubMenuItemDraft(sub: SubMenuItem): SubMenuItemDraft {
  return {
    name: sub.name ?? '',
    type: sub.type === 'link' ? 'link' : 'send_message',
    send_message: sub.send_message ?? '',
    link: sub.link ?? 'https://',
  }
}

export function toMenuItemDraft(item: MenuItem): MenuItemDraft {
  return {
    key: `item_${randomSuffix()}`,
    name: item.name ?? '',
    type: item.type,
    send_message: item.send_message ?? '',
    link: item.link ?? 'https://',
    switch: {
      switch_id: item.switch?.switch_id ?? `switch_${randomSuffix()}`,
      default: Boolean(item.switch?.default),
    },
    sub_menu_items: (item.sub_menu_items ?? []).map(toSubMenuItemDraft),
  }
}

export function toMenuDraft(menu?: Menu | null): MenuDraft {
  return { items: (menu?.items ?? []).map(toMenuItemDraft) }
}

export function toPanelItemDraft(item: PanelItem): PanelItemDraft {
  return {
    key: `item_${randomSuffix()}`,
    name: item.name ?? '',
    desc: item.desc ?? '',
    type: item.type === 'link' ? 'link' : 'command',
    only_admin: Boolean(item.only_admin),
    link: item.link ?? 'https://',
  }
}

export function toPanelDraft(panel?: Panel | null): PanelDraft {
  return {
    items: (panel?.items ?? []).map(toPanelItemDraft),
    remark: panel?.remark ?? '',
  }
}

/** 列表接口返回的记录里可能没有 items，做一次兜底 */
export function toPanelDraftFromRecord(record: PanelRecord): PanelDraft {
  return toPanelDraft(record.panel)
}

// ---------------------------------------------------------------- 草稿 → 接口

/** 只保留当前 type 对应的字段，避免把无关字段发给开放平台 */
export function normalizeMenu(draft: MenuDraft): Menu {
  return {
    items: draft.items.map((item) => {
      const result: MenuItem = { name: item.name.trim(), type: item.type }
      if (item.type === 'send_message') result.send_message = item.send_message.trim()
      if (item.type === 'link') result.link = item.link.trim()
      if (item.type === 'switch') {
        result.switch = {
          switch_id: item.switch.switch_id.trim(),
          default: Boolean(item.switch.default),
        }
      }
      if (item.type === 'menu') {
        result.sub_menu_items = item.sub_menu_items.map((sub) => {
          const nested: SubMenuItem = { name: sub.name.trim(), type: sub.type }
          if (sub.type === 'send_message') nested.send_message = sub.send_message.trim()
          if (sub.type === 'link') nested.link = sub.link.trim()
          return nested
        })
      }
      return result
    }),
  }
}

export function normalizePanel(draft: PanelDraft): Panel {
  const result: Panel = {
    items: draft.items.map((item) => {
      const normalized: PanelItem = {
        name: item.name.trim(),
        type: item.type,
        only_admin: item.only_admin,
      }
      const desc = item.desc.trim()
      if (desc) normalized.desc = desc
      if (item.type === 'link') normalized.link = item.link.trim()
      return normalized
    }),
  }
  const remark = draft.remark.trim()
  if (remark) result.remark = remark
  return result
}

// ---------------------------------------------------------------- 校验

function checkUrl(value: string, path: string, label: string, issues: Issue[]) {
  const url = value.trim()
  if (!url) {
    issues.push({ path, message: `${label}需要填写链接` })
  } else if (!HTTPS.test(url)) {
    issues.push({ path, message: `${label}的链接必须以 https:// 开头` })
  }
}

export function validateMenu(draft: MenuDraft): Issue[] {
  const issues: Issue[] = []
  const items = draft.items

  if (items.length === 0) {
    issues.push({ path: 'items', message: '菜单至少需要一个一级菜单项' })
  } else if (items.length > LIMITS.menuItems) {
    issues.push({
      path: 'items',
      message: `一级菜单最多 ${LIMITS.menuItems} 个，当前 ${items.length} 个`,
    })
  }

  const switchIds = new Map<string, number>()

  items.forEach((item, index) => {
    const path = `items.${index}`
    const name = item.name.trim()
    const label = name ? `「${name}」` : `第 ${index + 1} 个菜单`

    if (!name) {
      issues.push({ path: `${path}.name`, message: `第 ${index + 1} 个菜单缺少名称` })
    } else if (countUnits(name) > LIMITS.menuItemName) {
      issues.push({
        path: `${path}.name`,
        message: `${label}名称超出 ${LIMITS.menuItemName} 字符上限（中文按 2 字符计）`,
      })
    }

    if (item.type === 'send_message' && !item.send_message.trim()) {
      issues.push({ path: `${path}.send_message`, message: `${label}需要填写发送内容` })
    }
    if (item.type === 'link') {
      checkUrl(item.link, `${path}.link`, label, issues)
    }
    if (item.type === 'switch') {
      const switchId = item.switch.switch_id.trim()
      if (!switchId) {
        issues.push({ path: `${path}.switch`, message: `${label}需要填写开关标识 switch_id` })
      } else {
        const previous = switchIds.get(switchId)
        if (previous !== undefined) {
          issues.push({
            path: `${path}.switch`,
            message: `开关标识「${switchId}」与第 ${previous + 1} 个菜单重复`,
          })
        } else {
          switchIds.set(switchId, index)
        }
      }
    }

    if (item.type === 'menu') {
      const subs = item.sub_menu_items
      if (subs.length === 0) {
        issues.push({ path: `${path}.sub_menu_items`, message: `${label}的子菜单为空` })
      } else if (subs.length > LIMITS.subMenuItems) {
        issues.push({
          path: `${path}.sub_menu_items`,
          message: `${label}的子菜单最多 ${LIMITS.subMenuItems} 个，当前 ${subs.length} 个`,
        })
      }

      subs.forEach((sub, subIndex) => {
        const subPath = `${path}.sub_menu_items.${subIndex}`
        const subName = sub.name.trim()
        const subLabel = subName ? `「${subName}」` : `${label}第 ${subIndex + 1} 个子菜单`

        if (!subName) {
          issues.push({
            path: `${subPath}.name`,
            message: `${label}第 ${subIndex + 1} 个子菜单缺少名称`,
          })
        } else if (countUnits(subName) > LIMITS.subMenuItemName) {
          issues.push({
            path: `${subPath}.name`,
            message: `${subLabel}名称超出 ${LIMITS.subMenuItemName} 字符上限`,
          })
        }
        if (sub.type === 'send_message' && !sub.send_message.trim()) {
          issues.push({ path: `${subPath}.send_message`, message: `${subLabel}需要填写发送内容` })
        }
        if (sub.type === 'link') checkUrl(sub.link, `${subPath}.link`, subLabel, issues)
      })
    }
  })

  return issues
}

export function validatePanel(draft: PanelDraft): Issue[] {
  const issues: Issue[] = []
  const items = draft.items

  if (items.length === 0) {
    issues.push({ path: 'items', message: '面板至少需要一个元素' })
  } else if (items.length > LIMITS.panelItems) {
    issues.push({
      path: 'items',
      message: `一个面板最多 ${LIMITS.panelItems} 个元素，当前 ${items.length} 个`,
    })
  }

  if (draft.remark.trim().length > LIMITS.panelRemark) {
    issues.push({ path: 'remark', message: `备注超出 ${LIMITS.panelRemark} 字符上限` })
  }

  items.forEach((item, index) => {
    const path = `items.${index}`
    const name = item.name.trim()
    const label = name ? `「${name}」` : `第 ${index + 1} 个元素`

    if (!name) {
      issues.push({ path: `${path}.name`, message: `第 ${index + 1} 个元素缺少名称` })
    } else if (countUnits(name) > LIMITS.panelItemName) {
      issues.push({
        path: `${path}.name`,
        message: `${label}名称超出 ${LIMITS.panelItemName} 字符上限（中文按 2 字符计）`,
      })
    }

    if (countUnits(item.desc) > LIMITS.panelItemDesc) {
      issues.push({
        path: `${path}.desc`,
        message: `${label}描述超出 ${LIMITS.panelItemDesc} 字符上限`,
      })
    }

    if (item.type === 'link') checkUrl(item.link, `${path}.link`, label, issues)
  })

  return issues
}

/** 关联对象数量校验；返回提示文本，undefined 表示通过 */
export function validateTargets(openids: string[]): string | undefined {
  if (openids.length === 0) return '请至少填写一个 openid'
  if (openids.length > LIMITS.targetOpenids) {
    return `一次最多 ${LIMITS.targetOpenids} 个 openid，当前 ${openids.length} 个`
  }
  return undefined
}

/** 把多行文本解析成去重后的 openid 列表 */
export function parseOpenids(text: string): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of text.split(/[\s,;，；]+/)) {
    const id = raw.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    result.push(id)
  }
  return result
}
