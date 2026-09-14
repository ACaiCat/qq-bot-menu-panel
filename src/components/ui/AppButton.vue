<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue'

withDefaults(
  defineProps<{
    variant?: 'default' | 'primary' | 'outline' | 'ghost' | 'danger'
    size?: 'md' | 'sm'
    /** 前置图标名，见 AppIcon */
    icon?: string
    loading?: boolean
    disabled?: boolean
    type?: 'button' | 'submit'
  }>(),
  { variant: 'default', size: 'md', loading: false, disabled: false, type: 'button' },
)
</script>

<template>
  <button
    :type="type"
    class="btn"
    :class="[`btn--${variant}`, size === 'sm' && 'btn--sm']"
    :disabled="disabled || loading"
  >
    <span v-if="loading" class="spinner" />
    <AppIcon v-else-if="icon" :name="icon" :size="size === 'sm' ? 13 : 15" />
    <slot />
  </button>
</template>
