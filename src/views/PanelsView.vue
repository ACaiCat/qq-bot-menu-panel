<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { api } from '@/api/client'
import type { PanelRecord, Scope } from '@/api/types'
import PanelEditorModal from '@/components/panel/PanelEditorModal.vue'
import PanelTargetModal from '@/components/panel/PanelTargetModal.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppEmpty from '@/components/ui/AppEmpty.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppModal from '@/components/ui/AppModal.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { useScrollEdge } from '@/composables/useScrollEdge'
import { useToast } from '@/composables/useToast'
import {
  ALL_SCOPES,
  LIMITS,
  PANEL_TYPE_ICONS,
  PANEL_TYPE_LABELS,
  SCOPE_HINTS,
  SCOPE_ICONS,
  SCOPE_LABELS,
  SCOPES_SUPPORTING_TARGET,
  TARGET_TYPE_ICONS,
  TARGET_TYPE_LABELS,
} from '@/utils/constants'
import { formatDateTime } from '@/utils/format'

const toast = useToast()
const scrolled = useScrollEdge()

const scope = ref<Scope>('c2c')
const records = ref<PanelRecord[]>([])
const nextCursor = ref('')
const isEnd = ref(true)
const loading = ref(false)
const loadingMore = ref(false)
const loaded = ref(false)

const creating = ref(false)
const editing = ref<PanelRecord | null>(null)
const targeting = ref<PanelRecord | null>(null)
const deleting = ref<PanelRecord | null>(null)
const removing = ref(false)

const scopeOptions = ALL_SCOPES.map((value) => ({
  value,
  label: SCOPE_LABELS[value],
  icon: SCOPE_ICONS[value],
  hint: SCOPE_HINTS[value],
}))

const totalText = computed(() =>
  isEnd.value ? `共 ${records.value.length} 个面板` : `已加载 ${records.value.length} 个`,
)

async function load() {
  loading.value = true
  try {
    const data = await api.listPanels(scope.value)
    records.value = data.records ?? []
    nextCursor.value = data.next_cursor ?? ''
    isEnd.value = data.is_end ?? true
  } catch (error) {
    toast.failure(error)
    records.value = []
  } finally {
    loading.value = false
    loaded.value = true
  }
}

async function loadMore() {
  if (!nextCursor.value) return
  loadingMore.value = true
  try {
    const data = await api.listPanels(scope.value, nextCursor.value)
    records.value = [...records.value, ...(data.records ?? [])]
    nextCursor.value = data.next_cursor ?? ''
    isEnd.value = data.is_end ?? true
  } catch (error) {
    toast.failure(error)
  } finally {
    loadingMore.value = false
  }
}

function changeScope(next: Scope) {
  if (scope.value === next) return
  scope.value = next
  records.value = []
  loaded.value = false
  load()
}

function supportsTarget(record: PanelRecord) {
  return SCOPES_SUPPORTING_TARGET.includes(record.scope) && record.target_type === 'specific'
}

async function confirmDelete() {
  const record = deleting.value
  if (!record) return
  removing.value = true
  try {
    await api.deletePanel(record.panel_id)
    toast.success('指令面板已删除', record.panel_id)
    deleting.value = null
    await load()
  } catch (error) {
    toast.failure(error)
  } finally {
    removing.value = false
  }
}

async function onSaved() {
  creating.value = false
  editing.value = null
  targeting.value = null
  await load()
}

onMounted(load)
</script>

<template>
  <div>
    <header class="page-bar" :class="scrolled && 'page-bar--scrolled'">
      <div class="page-bar__inner">
        <div class="page-bar__heading">
          <h1 class="page-title">指令面板</h1>
          <p class="page-desc">
            按场景配置面板，最多创建 {{ LIMITS.panelCount }}
            个。单聊与群聊支持指定对象生效，文字子频道与频道私信仅支持全局。
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <AppButton variant="outline" icon="refresh" :loading="loading" @click="load">
            刷新
          </AppButton>
          <AppButton variant="primary" icon="plus" @click="creating = true">新建面板</AppButton>
        </div>
      </div>
    </header>

    <div class="page-body">
      <div class="flex flex-wrap items-center gap-3.5">
        <SegmentedControl
          :model-value="scope"
          :options="scopeOptions"
          @update:model-value="changeScope"
        />
        <span class="text-[12px] text-ink-subtle tabular-nums">{{ totalText }}</span>
      </div>

      <div class="flex flex-col gap-4">
        <div v-if="loading" class="flex flex-col gap-2.5">
          <div v-for="n in 3" :key="n" class="skeleton h-[128px]" />
        </div>

        <template v-else-if="records.length">
          <article
            v-for="record in records"
            :key="record.panel_id"
            class="card flex items-stretch gap-4 p-4 max-md:flex-col"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-[14px] font-[620] tracking-title">
                  {{ record.panel.remark || '未命名面板' }}
                </span>
                <span class="badge badge--accent">
                  <AppIcon :name="SCOPE_ICONS[record.scope]" :size="12" />
                  {{ SCOPE_LABELS[record.scope] }}
                </span>
                <span class="badge" :class="record.target_type === 'specific' && 'badge--warning'">
                  <AppIcon :name="TARGET_TYPE_ICONS[record.target_type]" :size="12" />
                  {{ TARGET_TYPE_LABELS[record.target_type] }}
                </span>
                <span class="badge">{{ record.panel.items?.length ?? 0 }} 个元素</span>
                <span v-if="record.version !== undefined" class="badge tabular-nums">
                  v{{ record.version }}
                </span>
              </div>

              <p class="mt-1 font-mono text-[11.5px] break-all text-ink-subtle">
                panel_id: {{ record.panel_id }}
              </p>

              <ul
                v-if="record.panel.items?.length"
                class="mt-2.5 flex list-none flex-wrap gap-1.5 p-0"
              >
                <li v-for="(item, index) in record.panel.items" :key="index" class="chip">
                  <AppIcon :name="PANEL_TYPE_ICONS[item.type]" :size="12" class="text-ink-subtle" />
                  <span class="font-[550]">{{ item.name }}</span>
                  <span class="chip__type">{{ PANEL_TYPE_LABELS[item.type] }}</span>
                </li>
              </ul>
              <p v-else class="mt-2.5 text-[12px] text-ink-subtle">该面板还没有配置元素</p>

              <p class="mt-2.5 text-[11.5px] text-ink-subtle">
                更新于 {{ formatDateTime(record.updated_at) }}
                <template v-if="record.created_at">
                  · 创建于 {{ formatDateTime(record.created_at) }}
                </template>
              </p>
            </div>

            <div
              class="flex flex-none flex-col justify-center gap-2 max-md:flex-row max-md:flex-wrap"
            >
              <AppButton
                v-if="supportsTarget(record)"
                variant="outline"
                size="sm"
                icon="users"
                @click="targeting = record"
              >
                关联对象
              </AppButton>
              <AppButton variant="outline" size="sm" icon="edit" @click="editing = record">
                编辑
              </AppButton>
              <AppButton variant="danger" size="sm" icon="trash" @click="deleting = record">
                删除
              </AppButton>
            </div>
          </article>

          <div v-if="!isEnd" class="flex justify-center">
            <AppButton variant="outline" :loading="loadingMore" @click="loadMore"
              >加载更多</AppButton
            >
          </div>
        </template>

        <AppEmpty
          v-else-if="loaded"
          icon="panels"
          :title="`${SCOPE_LABELS[scope]}场景下还没有指令面板`"
          :desc="SCOPE_HINTS[scope] + '。创建后，用户可以在输入框上方看到这些指令。'"
        >
          <AppButton
            variant="primary"
            size="sm"
            icon="plus"
            class="mt-1.5"
            @click="creating = true"
          >
            新建面板
          </AppButton>
        </AppEmpty>
      </div>
    </div>

    <PanelEditorModal
      v-if="creating"
      mode="create"
      :scope="scope"
      @close="creating = false"
      @saved="onSaved"
    />

    <PanelEditorModal
      v-if="editing"
      mode="edit"
      :scope="editing.scope"
      :record="editing"
      @close="editing = null"
      @saved="onSaved"
    />

    <PanelTargetModal
      v-if="targeting"
      :record="targeting"
      @close="targeting = null"
      @saved="onSaved"
    />

    <AppModal
      v-if="deleting"
      title="删除指令面板"
      size="sm"
      :close-on-mask="!removing"
      @close="deleting = null"
    >
      <div class="notice notice--danger">
        <AppIcon name="warning" :size="15" class="mt-px shrink-0" />
        <span>
          删除后该面板将不再对任何用户或群生效，且无法恢复。
          <br />
          <code>{{ deleting.panel_id }}</code>
        </span>
      </div>

      <template #footer>
        <div class="flex-1" />
        <AppButton variant="ghost" :disabled="removing" @click="deleting = null">取消</AppButton>
        <AppButton variant="danger" icon="trash" :loading="removing" @click="confirmDelete">
          确认删除
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>
