<script setup lang="ts">
import { computed } from 'vue'

import type { PanelItemType } from '@/api/types'
import AppField from '@/components/ui/AppField.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import { LIMITS, PANEL_TYPE_ICONS, PANEL_TYPE_LABELS } from '@/utils/constants'
import { countUnits } from '@/utils/format'
import type { PanelItemDraft } from '@/utils/draft'

const props = defineProps<{
  item: PanelItemDraft
  index: number
  total: number
  /** 仅当前这一行的校验问题 */
  issues: string[]
  /** 是否正被拖动 */
  dragging: boolean
  /** 拖动中的位移，由弹簧逐帧写入 */
  offset: number
}>()

const emit = defineEmits<{
  remove: []
  move: [to: number]
  /** 手柄按下，交给排序逻辑接管 */
  gripdown: [event: PointerEvent]
}>()

const typeOptions = (Object.keys(PANEL_TYPE_LABELS) as PanelItemType[]).map((value) => ({
  value,
  label: PANEL_TYPE_LABELS[value],
  icon: PANEL_TYPE_ICONS[value],
}))

const nameIssues = computed(() => props.issues.filter((issue) => issue.includes('名称')))

const label = computed(() => props.item.name || '未命名元素')

/** 切成链接类型时补一个合规前缀 */
function onTypeChange() {
  if (props.item.type === 'link' && !props.item.link.startsWith('https://')) {
    props.item.link = 'https://'
  }
}
</script>

<template>
  <div
    data-drag-item
    class="drag-item flex flex-col gap-2.5 rounded-md border border-separator bg-surface-2 p-3"
    :class="{ 'drag-item--dragging': dragging, 'border-danger/45': issues.length > 0 }"
    :style="{ '--drag-offset': `${offset}px` }"
  >
    <div class="flex flex-wrap items-center gap-2">
      <!-- 拖拽手柄。键盘用户走右边的上移 / 下移按钮，不是把拖拽硬塞给键盘 -->
      <span
        data-drag-handle
        class="drag-item__grip"
        title="按住拖动排序"
        aria-hidden="true"
        @pointerdown="emit('gripdown', $event)"
      >
        <AppIcon name="grip" :size="16" />
      </span>

      <span class="drag-item__index">{{ index + 1 }}</span>

      <div class="w-[124px]">
        <AppSelect
          v-model="item.type"
          size="sm"
          :options="typeOptions"
          @update:model-value="onTypeChange"
        />
      </div>

      <div class="flex-1" />

      <AppSwitch v-model="item.only_admin" label="仅管理员可点击" />

      <div class="flex shrink-0 gap-0.5">
        <button
          type="button"
          class="btn btn--ghost btn--sm btn--icon"
          :aria-label="`把「${label}」上移`"
          :disabled="index === 0"
          @click="emit('move', index - 1)"
        >
          <AppIcon name="arrow-up" :size="15" />
        </button>
        <button
          type="button"
          class="btn btn--ghost btn--sm btn--icon"
          :aria-label="`把「${label}」下移`"
          :disabled="index === total - 1"
          @click="emit('move', index + 1)"
        >
          <AppIcon name="arrow-down" :size="15" />
        </button>
        <button
          type="button"
          class="btn btn--ghost btn--sm btn--icon"
          :aria-label="`删除「${label}」`"
          @click="emit('remove')"
        >
          <AppIcon name="close" :size="14" />
        </button>
      </div>
    </div>

    <div class="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2.5">
      <AppField
        label="名称"
        required
        :current="countUnits(item.name)"
        :max="LIMITS.panelItemName"
        :issues="nameIssues"
      >
        <AppInput
          v-model="item.name"
          size="sm"
          placeholder="点击后填入输入框的内容，例如：查询天气"
          :invalid="nameIssues.length > 0"
        />
      </AppField>

      <AppField label="描述" :current="countUnits(item.desc)" :max="LIMITS.panelItemDesc">
        <AppInput v-model="item.desc" size="sm" placeholder="展示在名称下方的补充说明" />
      </AppField>
    </div>

    <AppField v-if="item.type === 'link'" label="跳转链接" required hint="必须以 https:// 开头">
      <AppInput v-model="item.link" size="sm" placeholder="https://example.com" monospace />
    </AppField>

    <ul v-if="issues.length" class="issue-list">
      <li v-for="issue in issues" :key="issue" class="issue-list__item text-danger-ink">
        <span class="mt-[7px] size-1 shrink-0 rounded-full bg-current" />
        <span>{{ issue }}</span>
      </li>
    </ul>
  </div>
</template>
