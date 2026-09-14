<script setup lang="ts" generic="T extends string">
import AppIcon from '@/components/ui/AppIcon.vue'

defineProps<{
  options: { value: T; label: string; disabled?: boolean; hint?: string; icon?: string }[]
}>()

const model = defineModel<T>({ required: true })
</script>

<template>
  <div class="segmented" role="tablist">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      role="tab"
      class="segmented__item"
      :class="{ 'segmented__item--active': model === option.value }"
      :disabled="option.disabled"
      :title="option.hint"
      :aria-selected="model === option.value"
      @click="model = option.value"
    >
      <AppIcon v-if="option.icon" :name="option.icon" :size="13" />
      {{ option.label }}
    </button>
  </div>
</template>
