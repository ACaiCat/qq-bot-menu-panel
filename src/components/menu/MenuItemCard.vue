<script setup lang="ts">
import { computed, ref } from 'vue'

import type { MenuItemType } from '@/api/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppField from '@/components/ui/AppField.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppInput from '@/components/ui/AppInput.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import AppSwitch from '@/components/ui/AppSwitch.vue'
import {
  LIMITS,
  MENU_TYPE_HINTS,
  MENU_TYPE_ICONS,
  MENU_TYPE_LABELS,
  SUB_MENU_TYPES,
} from '@/utils/constants'
import {
  createSubMenuItemDraft,
  type Issue,
  type MenuItemDraft,
  type SubMenuItemDraft,
} from '@/utils/draft'
import { countUnits } from '@/utils/format'

const props = defineProps<{
  item: MenuItemDraft
  index: number
  total: number
  issues: Issue[]
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

const expanded = ref(true)

const typeOptions = (Object.keys(MENU_TYPE_LABELS) as MenuItemType[]).map((value) => ({
  value,
  label: MENU_TYPE_LABELS[value],
  icon: MENU_TYPE_ICONS[value],
}))

const label = computed(() => props.item.name || '未命名菜单')

/** 该卡片自身的问题，不含子菜单的问题 */
const ownIssues = computed(() =>
  props.issues.filter((issue) => !issue.path.startsWith(`items.${props.index}.sub_menu_items.`)),
)

const subIssues = computed(() =>
  props.issues.filter((issue) => issue.path.startsWith(`items.${props.index}.sub_menu_items.`)),
)

const nameIssues = computed(() =>
  props.issues.filter((issue) => issue.path === `items.${props.index}.name`).map((i) => i.message),
)

const subItems = computed(() => props.item.sub_menu_items)

function addSubItem() {
  if (subItems.value.length >= LIMITS.subMenuItems) return
  props.item.sub_menu_items = [...subItems.value, createSubMenuItemDraft()]
}

function removeSubItem(subIndex: number) {
  props.item.sub_menu_items = subItems.value.filter((_, index) => index !== subIndex)
}

/** 切成链接类型时补一个合规前缀，省得用户手打 */
function onSubTypeChange(sub: SubMenuItemDraft) {
  if (sub.type === 'link' && !sub.link.startsWith('https://')) sub.link = 'https://'
}
</script>

<template>
  <article
    data-drag-item
    class="menu-item drag-item"
    :class="{ 'drag-item--dragging': dragging, 'menu-item--invalid': ownIssues.length > 0 }"
    :style="{ '--drag-offset': `${offset}px` }"
  >
    <header class="flex items-center gap-1 py-2 pr-2.5 pl-1">
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

      <button
        type="button"
        class="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-sm p-1 text-left"
        :aria-expanded="expanded"
        @click="expanded = !expanded"
      >
        <span class="drag-item__index">{{ index + 1 }}</span>
        <span class="truncate text-[13.5px] font-[580]">{{ label }}</span>
        <span class="badge">
          <AppIcon :name="MENU_TYPE_ICONS[item.type]" :size="12" />
          {{ MENU_TYPE_LABELS[item.type] }}
        </span>
        <span v-if="ownIssues.length" class="badge badge--danger">
          <AppIcon name="warning" :size="12" />
          {{ ownIssues.length }} 项待修正
        </span>
        <AppIcon
          name="chevron-down"
          :size="14"
          class="menu-item__caret text-ink-subtle"
          :class="expanded && 'rotate-180'"
        />
      </button>

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
          <AppIcon name="trash" :size="15" />
        </button>
      </div>
    </header>

    <div v-show="expanded" class="flex flex-col gap-3.5 border-t border-separator p-3.5">
      <div class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
        <AppField
          label="菜单名称"
          required
          :current="countUnits(item.name)"
          :max="LIMITS.menuItemName"
          :issues="nameIssues"
        >
          <AppInput v-model="item.name" placeholder="例如：帮助" :invalid="nameIssues.length > 0" />
        </AppField>

        <AppField label="菜单类型" required :hint="MENU_TYPE_HINTS[item.type]">
          <AppSelect v-model="item.type" :options="typeOptions" />
        </AppField>
      </div>

      <AppField
        v-if="item.type === 'send_message'"
        label="发送内容"
        required
        hint="点击后填入输入框，用户确认后才会发送"
      >
        <AppInput v-model="item.send_message" placeholder="例如：/help" />
      </AppField>

      <AppField v-if="item.type === 'link'" label="跳转链接" required hint="必须以 https:// 开头">
        <AppInput v-model="item.link" type="url" placeholder="https://example.com" monospace />
      </AppField>

      <div
        v-if="item.type === 'switch'"
        class="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5"
      >
        <AppField
          label="开关标识 switch_id"
          required
          hint="状态变化时会在消息 ext 中携带，例如开启后带上 search=1"
        >
          <AppInput v-model="item.switch.switch_id" placeholder="例如：search" monospace />
        </AppField>
        <AppField label="默认状态">
          <AppSwitch
            v-model="item.switch.default"
            :label="item.switch.default ? '默认开启' : '默认关闭'"
          />
        </AppField>
      </div>

      <section
        v-if="item.type === 'menu'"
        class="rounded-md border border-separator bg-surface-2 p-3"
      >
        <div class="mb-2.5 flex flex-wrap items-center gap-2">
          <span class="text-[12.5px] font-semibold">子菜单</span>
          <span class="text-[11.5px] text-ink-subtle">
            最多 {{ LIMITS.subMenuItems }} 个，不支持再嵌套
          </span>
          <div class="flex-1" />
          <AppButton
            size="sm"
            variant="outline"
            icon="plus"
            :disabled="subItems.length >= LIMITS.subMenuItems"
            @click="addSubItem"
          >
            添加子菜单
          </AppButton>
        </div>

        <p v-if="!subItems.length" class="py-2.5 text-center text-[12px] text-ink-subtle">
          还没有子菜单，点击右上角添加
        </p>

        <div
          v-for="(sub, subIndex) in subItems"
          :key="subIndex"
          class="mb-2 grid grid-cols-[minmax(120px,1fr)_124px_minmax(160px,1.4fr)_auto] items-center gap-2 max-md:grid-cols-[minmax(0,1fr)_auto]"
        >
          <AppInput
            v-model="sub.name"
            size="sm"
            :placeholder="`子菜单名称（≤${LIMITS.subMenuItemName} 字符）`"
          />
          <AppSelect
            v-model="sub.type"
            size="sm"
            :options="SUB_MENU_TYPES"
            @update:model-value="onSubTypeChange(sub)"
          />
          <AppInput
            v-if="sub.type === 'send_message'"
            v-model="sub.send_message"
            size="sm"
            placeholder="填入输入框的内容"
          />
          <AppInput
            v-else
            v-model="sub.link"
            size="sm"
            placeholder="https://example.com"
            monospace
          />
          <button
            type="button"
            class="btn btn--ghost btn--sm btn--icon"
            :aria-label="`删除第 ${subIndex + 1} 个子菜单`"
            @click="removeSubItem(subIndex)"
          >
            <AppIcon name="close" :size="14" />
          </button>
        </div>

        <ul v-if="subIssues.length" class="issue-list mt-1.5">
          <li v-for="issue in subIssues" :key="issue.path" class="issue-list__item text-danger-ink">
            <span class="mt-[7px] size-1 shrink-0 rounded-full bg-current" />
            <span>{{ issue.message }}</span>
          </li>
        </ul>
      </section>
    </div>
  </article>
</template>

<style scoped>
/* 位移、抬起、手柄这些通用规则在 main.css 的 .drag-item* 里，与面板元素共用 */
.menu-item {
  border: 1px solid var(--color-separator);
  border-radius: var(--radius-lg);
  background-color: var(--color-surface);
  box-shadow: var(--shadow-xs);
}

.menu-item--invalid {
  border-color: color-mix(in srgb, var(--color-danger) 42%, var(--color-separator));
}

.menu-item__caret {
  flex: none;
  transition: transform 220ms var(--ease-spring);
}

@media (prefers-reduced-motion: reduce) {
  .menu-item__caret {
    transition: none;
  }
}
</style>
