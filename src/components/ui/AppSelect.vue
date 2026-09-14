<script setup lang="ts" generic="T extends string">
import { computed } from 'vue'

import AppIcon from '@/components/ui/AppIcon.vue'

const props = defineProps<{
  options: { value: T; label: string; disabled?: boolean; icon?: string }[]
  disabled?: boolean
  size?: 'md' | 'sm'
}>()

const model = defineModel<T>({ required: true })

/** 原生 select 里塞不进图标，所以在控件上叠一个，跟着当前选项走 */
const activeIcon = computed(
  () => props.options.find((option) => option.value === model.value)?.icon,
)
</script>

<template>
  <div class="relative min-w-0">
    <select
      v-model="model"
      :disabled="disabled"
      class="select"
      :class="[size === 'sm' && 'select--sm', activeIcon && 'pl-7']"
    >
      <option
        v-for="option in options"
        :key="option.value"
        :value="option.value"
        :disabled="option.disabled"
      >
        {{ option.label }}
      </option>
    </select>

    <AppIcon
      v-if="activeIcon"
      :name="activeIcon"
      :size="14"
      class="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-subtle"
    />
  </div>
</template>
