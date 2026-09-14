<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import { api } from '@/api/client'
import type { PanelRecord, Scope, TargetType } from '@/api/types'
import PanelItemRow from '@/components/panel/PanelItemRow.vue'
import AppButton from '@/components/ui/AppButton.vue'
import AppEmpty from '@/components/ui/AppEmpty.vue'
import AppField from '@/components/ui/AppField.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import IssueList from '@/components/ui/IssueList.vue'
import { useDragSort } from '@/composables/useDragSort'
import { useToast } from '@/composables/useToast'
import {
  ALL_SCOPES,
  LIMITS,
  SCOPE_HINTS,
  SCOPE_ICONS,
  SCOPE_LABELS,
  SCOPES_SUPPORTING_TARGET,
  TARGET_TYPE_ICONS,
} from '@/utils/constants'
import {
  createPanelItemDraft,
  normalizePanel,
  parseOpenids,
  toPanelDraft,
  validatePanel,
  validateTargets,
  type PanelDraft,
} from '@/utils/draft'

const props = withDefaults(
  defineProps<{
    mode: 'create' | 'edit'
    /** 创建时的初始场景 */
    scope: Scope
    record?: PanelRecord | null
  }>(),
  { record: null },
)

const emit = defineEmits<{ close: []; saved: [] }>()

const toast = useToast()

const draft = ref<PanelDraft>(toPanelDraft(props.record?.panel))
const panelScope = ref<Scope>(props.record?.scope ?? props.scope)
const targetType = ref<TargetType>(props.record?.target_type ?? 'all')
const userOpenidsText = ref((props.record?.user_openids ?? []).join('\n'))
const groupOpenidsText = ref((props.record?.group_openids ?? []).join('\n'))
const saving = ref(false)
const showJson = ref(false)

const scopeOptions = ALL_SCOPES.map((value) => ({
  value,
  label: SCOPE_LABELS[value],
  icon: SCOPE_ICONS[value],
}))

const supportsTarget = computed(() => SCOPES_SUPPORTING_TARGET.includes(panelScope.value))

const targetOptions = computed(() => [
  { value: 'all' as TargetType, label: '全部用户 / 群', icon: TARGET_TYPE_ICONS.all },
  {
    value: 'specific' as TargetType,
    label: '仅指定对象',
    icon: TARGET_TYPE_ICONS.specific,
    disabled: !supportsTarget.value,
  },
])

const userOpenids = computed(() => parseOpenids(userOpenidsText.value))
const groupOpenids = computed(() => parseOpenids(groupOpenidsText.value))

const issues = computed(() => validatePanel(draft.value))

/** 仅创建阶段需要校验关联对象 */
const targetIssue = computed(() => {
  if (props.mode !== 'create' || targetType.value !== 'specific') return undefined
  const list = panelScope.value === 'c2c' ? userOpenids.value : groupOpenids.value
  const problem = validateTargets(list)
  return problem && list.length > 0 ? problem : undefined
})

const payload = computed(() => normalizePanel(draft.value))
const canSubmit = computed(() => issues.value.length === 0 && !targetIssue.value && !saving.value)

watch(panelScope, (scope) => {
  if (!SCOPES_SUPPORTING_TARGET.includes(scope)) targetType.value = 'all'
})

function addItem() {
  if (draft.value.items.length >= LIMITS.panelItems) {
    toast.error(`一个面板最多 ${LIMITS.panelItems} 个元素`)
    return
  }
  draft.value.items.push(createPanelItemDraft())
}

function removeItem(index: number) {
  draft.value.items.splice(index, 1)
}

function moveItem(from: number, to: number) {
  if (to < 0 || to >= draft.value.items.length || from === to) return
  const list = draft.value.items
  const [moved] = list.splice(from, 1)
  if (moved) list.splice(to, 0, moved)
}

const listRef = ref<HTMLElement | null>(null)

const { draggingIndex, offsets, onGripPointerDown } = useDragSort({
  container: listRef,
  onReorder: moveItem,
})

function onGripDown(event: PointerEvent, index: number) {
  onGripPointerDown(event, index)
}

function issuesFor(index: number): string[] {
  const prefix = `items.${index}.`
  return issues.value.filter((issue) => issue.path.startsWith(prefix)).map((issue) => issue.message)
}

async function submit() {
  if (issues.value.length > 0) {
    toast.error('还有未修正的配置问题', '请先按提示修改后再保存')
    return
  }

  saving.value = true
  try {
    if (props.mode === 'create') {
      const result = await api.createPanel({
        scope: panelScope.value,
        target_type: targetType.value,
        user_openids:
          targetType.value === 'specific' && panelScope.value === 'c2c'
            ? userOpenids.value
            : undefined,
        group_openids:
          targetType.value === 'specific' && panelScope.value === 'group'
            ? groupOpenids.value
            : undefined,
        panel: payload.value,
      })
      toast.success('指令面板已创建', `panel_id: ${result.panel_id}`)
    } else if (props.record) {
      const result = await api.updatePanel(props.record.panel_id, payload.value)
      toast.success(
        '指令面板已更新',
        typeof result.version === 'number' ? `面板版本已更新为 v${result.version}` : undefined,
      )
    }
    emit('saved')
  } catch (error) {
    toast.failure(error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <AppModal
    :title="mode === 'create' ? '新建指令面板' : '编辑指令面板'"
    :subtitle="
      mode === 'create'
        ? `一个机器人最多创建 ${LIMITS.panelCount} 个指令面板`
        : `panel_id: ${record?.panel_id}`
    "
    size="wide"
    @close="emit('close')"
  >
    <div class="flex flex-col gap-5">
      <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3.5">
        <AppField label="生效场景" required :hint="SCOPE_HINTS[panelScope]">
          <AppSelect v-model="panelScope" :options="scopeOptions" :disabled="mode === 'edit'" />
        </AppField>

        <AppField
          label="生效范围"
          required
          :hint="
            supportsTarget
              ? '选择「仅指定对象」后需要在下方填写 openid'
              : `${SCOPE_LABELS[panelScope]}场景仅支持全局生效`
          "
        >
          <AppSelect v-model="targetType" :options="targetOptions" :disabled="mode === 'edit'" />
        </AppField>
      </div>

      <template v-if="mode === 'create' && targetType === 'specific'">
        <AppField
          v-if="panelScope === 'c2c'"
          label="用户 openid"
          required
          :hint="`每行一个或用逗号分隔，一次最多 ${LIMITS.targetOpenids} 个`"
          :issues="targetIssue ? [targetIssue] : []"
        >
          <AppTextarea v-model="userOpenidsText" :rows="3" placeholder="openid_user_001" />
        </AppField>

        <AppField
          v-else
          label="群 openid"
          required
          :hint="`每行一个或用逗号分隔，一次最多 ${LIMITS.targetOpenids} 个`"
          :issues="targetIssue ? [targetIssue] : []"
        >
          <AppTextarea v-model="groupOpenidsText" :rows="3" placeholder="openid_group_001" />
        </AppField>
      </template>

      <AppField
        label="备注"
        :current="draft.remark.length"
        :max="LIMITS.panelRemark"
        hint="仅开发者可见，不会展示给用户，便于区分多个面板"
      >
        <AppInput v-model="draft.remark" placeholder="例如：主面板 / 测试面板" />
      </AppField>

      <IssueList
        v-if="issues.length"
        :issues="issues.map((issue) => issue.message)"
        title="保存前需要修正以下问题"
      />

      <section class="flex flex-col gap-2.5">
        <div class="flex items-center gap-2">
          <span class="text-[12.5px] font-semibold">面板元素</span>
          <span class="text-[11.5px] text-ink-subtle tabular-nums">
            {{ draft.items.length }} / {{ LIMITS.panelItems }}
          </span>
          <div class="flex-1" />
          <AppButton
            size="sm"
            variant="outline"
            icon="plus"
            :disabled="draft.items.length >= LIMITS.panelItems"
            @click="addItem"
          >
            添加元素
          </AppButton>
        </div>

        <AppEmpty
          v-if="!draft.items.length"
          icon="terminal"
          title="还没有面板元素"
          desc="「指令」类型的元素被点击后会把名称填入输入框；「链接跳转」类型会在浏览器中打开链接。"
        >
          <AppButton variant="primary" size="sm" icon="plus" class="mt-1.5" @click="addItem">
            添加元素
          </AppButton>
        </AppEmpty>

        <!-- 元素各自的位移由排序逻辑逐帧写入，不再走原生拖放 -->
        <div v-else ref="listRef" class="flex flex-col gap-2.5">
          <PanelItemRow
            v-for="(item, index) in draft.items"
            :key="item.key"
            :item="item"
            :index="index"
            :total="draft.items.length"
            :issues="issuesFor(index)"
            :dragging="draggingIndex === index"
            :offset="offsets[index] ?? 0"
            @remove="removeItem(index)"
            @move="moveItem(index, $event)"
            @gripdown="onGripDown($event, index)"
          />
        </div>
      </section>

      <div>
        <AppButton variant="ghost" size="sm" @click="showJson = !showJson">
          {{ showJson ? '隐藏' : '查看' }}请求体
        </AppButton>
        <pre
          v-if="showJson"
          class="mt-2 overflow-x-auto rounded-md border border-separator bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed text-ink-muted"
          >{{ JSON.stringify({ panel: payload }, null, 2) }}</pre>
      </div>
    </div>

    <template #footer>
      <span v-if="!canSubmit && issues.length" class="text-[12.5px] text-ink-muted">
        有 {{ issues.length }} 项待修正
      </span>
      <div class="flex-1" />
      <AppButton variant="ghost" :disabled="saving" @click="emit('close')">取消</AppButton>
      <AppButton variant="primary" :loading="saving" :disabled="!canSubmit" @click="submit">
        {{ mode === 'create' ? '创建面板' : '保存修改' }}
      </AppButton>
    </template>
  </AppModal>
</template>
