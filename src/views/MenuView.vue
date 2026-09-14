<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { api } from '@/api/client'
import type { MenuItemType } from '@/api/types'
import MenuItemCard from '@/components/menu/MenuItemCard.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppEmpty from '@/components/ui/AppEmpty.vue'
import IssueList from '@/components/ui/IssueList.vue'
import { useDragSort } from '@/composables/useDragSort'
import { useScrollEdge } from '@/composables/useScrollEdge'
import { useToast } from '@/composables/useToast'
import { LIMITS } from '@/utils/constants'
import {
  createMenuItemDraft,
  normalizeMenu,
  toMenuDraft,
  validateMenu,
  type MenuDraft,
  type MenuItemDraft,
} from '@/utils/draft'

const toast = useToast()
const scrolled = useScrollEdge()

const draft = ref<MenuDraft>({ items: [] })
/** 最近一次与服务端同步的草稿，用来判断是否有未保存的修改 */
const serverDraft = ref<MenuDraft>({ items: [] })
const remoteVersion = ref<number | null>(null)
const loading = ref(false)
const saving = ref(false)
const loaded = ref(false)
const showJson = ref(false)
const listRef = ref<HTMLElement | null>(null)

const issues = computed(() => validateMenu(draft.value))
const payload = computed(() => normalizeMenu(draft.value))
const isDirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(serverDraft.value))
const canSave = computed(() => isDirty.value && issues.value.length === 0 && !saving.value)

function moveItem(from: number, to: number) {
  if (to < 0 || to >= draft.value.items.length || from === to) return
  const list = draft.value.items
  const [moved] = list.splice(from, 1)
  if (moved) list.splice(to, 0, moved)
}

const { draggingIndex, offsets, onGripPointerDown } = useDragSort({
  container: listRef,
  onReorder: moveItem,
})

function onGripDown(event: PointerEvent, index: number) {
  onGripPointerDown(event, index)
}

async function load() {
  loading.value = true
  try {
    const data = await api.getMenu()
    remoteVersion.value = data.version ?? null
    const next = toMenuDraft(data.menu)
    draft.value = next
    serverDraft.value = JSON.parse(JSON.stringify(next)) as MenuDraft
  } catch (error) {
    toast.failure(error)
  } finally {
    loading.value = false
    loaded.value = true
  }
}

async function save() {
  if (issues.value.length > 0) {
    toast.error('还有未修正的配置问题', '请先按提示修改后再保存')
    return
  }
  saving.value = true
  try {
    const result = await api.putMenu(payload.value)
    if (typeof result.version === 'number') remoteVersion.value = result.version
    serverDraft.value = JSON.parse(JSON.stringify(draft.value)) as MenuDraft
    toast.success(
      '自定义菜单已保存',
      typeof result.version === 'number' ? `菜单版本已更新为 v${result.version}` : undefined,
    )
  } catch (error) {
    toast.failure(error)
  } finally {
    saving.value = false
  }
}

function revert() {
  draft.value = JSON.parse(JSON.stringify(serverDraft.value)) as MenuDraft
}

function addItem(type: MenuItemType = 'send_message') {
  if (draft.value.items.length >= LIMITS.menuItems) {
    toast.error(`一级菜单最多 ${LIMITS.menuItems} 个`)
    return
  }
  draft.value.items.push(createMenuItemDraft(type))
}

function removeItem(index: number) {
  draft.value.items.splice(index, 1)
}

/** 一键填充一份可直接保存的示例，方便快速上手 */
function fillSample() {
  const sample: MenuItemDraft[] = [
    { ...createMenuItemDraft('send_message'), name: '帮助', send_message: '/help' },
    {
      ...createMenuItemDraft('link'),
      name: '官网',
      link: 'https://bot.q.qq.com/wiki/',
    },
    {
      ...createMenuItemDraft('switch'),
      name: '搜索',
      switch: { switch_id: 'search', default: false },
    },
    {
      ...createMenuItemDraft('menu'),
      name: '更多',
      sub_menu_items: [
        { name: '设置', type: 'send_message', send_message: '/settings', link: 'https://' },
        { name: '反馈', type: 'link', send_message: '', link: 'https://example.com/feedback' },
      ],
    },
  ]
  draft.value.items = sample
}

onMounted(load)
</script>

<template>
  <div>
    <header class="page-bar" :class="scrolled && 'page-bar--scrolled'">
      <div class="page-bar__inner">
        <div class="page-bar__heading">
          <h1 class="page-title flex flex-wrap items-center gap-2">
            全局自定义菜单
            <span v-if="remoteVersion !== null" class="badge tabular-nums">
              v{{ remoteVersion }}
            </span>
            <span v-if="isDirty" class="badge badge--warning">
              <span class="badge__dot" />
              未保存
            </span>
          </h1>
          <p class="page-desc">
            仅在单聊窗口底部展示，设置后对所有用户生效。最多
            {{ LIMITS.menuItems }} 个一级菜单，每个一级菜单可带 {{ LIMITS.subMenuItems }} 个子菜单。
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <AppButton variant="ghost" :disabled="!isDirty || saving" @click="revert">
            放弃修改
          </AppButton>
          <AppButton variant="outline" icon="refresh" :loading="loading" @click="load">
            重新加载
          </AppButton>
          <AppButton
            variant="primary"
            icon="success"
            :loading="saving"
            :disabled="!canSave"
            @click="save"
          >
            保存菜单
          </AppButton>
        </div>
      </div>
    </header>

    <div class="page-body">
      <IssueList
        v-if="issues.length"
        :issues="issues.map((issue) => issue.message)"
        title="保存前需要修正以下问题"
      />

      <div v-if="loading && !loaded" class="flex flex-col gap-2.5">
        <div v-for="n in 2" :key="n" class="skeleton h-[92px]" />
      </div>

      <template v-else>
        <!-- 卡片各自的位移由排序逻辑逐帧写入，不再走原生拖放 -->
        <div ref="listRef" class="flex flex-col gap-2.5">
          <MenuItemCard
            v-for="(item, index) in draft.items"
            :key="item.key"
            :item="item"
            :index="index"
            :total="draft.items.length"
            :issues="issues"
            :dragging="draggingIndex === index"
            :offset="offsets[index] ?? 0"
            @remove="removeItem(index)"
            @move="moveItem(index, $event)"
            @gripdown="onGripDown($event, index)"
          />
        </div>

        <AppEmpty
          v-if="!draft.items.length"
          icon="menu"
          title="还没有配置菜单"
          desc="自定义菜单会显示在单聊窗口底部。可以从添加一个「发送消息」菜单开始。"
        >
          <div class="mt-1.5 flex flex-wrap items-center justify-center gap-2">
            <AppButton variant="primary" size="sm" icon="plus" @click="addItem('send_message')">
              添加菜单
            </AppButton>
            <AppButton variant="outline" size="sm" icon="sparkles" @click="fillSample">
              填充示例菜单
            </AppButton>
          </div>
        </AppEmpty>

        <template v-else>
          <div class="flex flex-wrap items-center gap-2">
            <AppButton
              variant="outline"
              icon="plus"
              :disabled="draft.items.length >= LIMITS.menuItems"
              @click="addItem('send_message')"
            >
              添加菜单
            </AppButton>
            <span class="text-[12px] text-ink-subtle tabular-nums">
              {{ draft.items.length }} / {{ LIMITS.menuItems }} 个一级菜单
            </span>
            <div class="flex-1" />
            <AppButton variant="ghost" size="sm" @click="showJson = !showJson">
              {{ showJson ? '隐藏' : '查看' }}请求体
            </AppButton>
          </div>

          <pre
            v-if="showJson"
            class="overflow-x-auto rounded-md border border-separator bg-surface-2 p-3.5 font-mono text-[11.5px] leading-relaxed text-ink-muted"
            >{{ JSON.stringify({ menu: payload }, null, 2) }}</pre>
        </template>
      </template>
    </div>
  </div>
</template>
