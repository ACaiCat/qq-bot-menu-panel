<script setup lang="ts">
withDefaults(
  defineProps<{
    type?: 'text' | 'password' | 'url'
    placeholder?: string
    invalid?: boolean
    disabled?: boolean
    monospace?: boolean
    size?: 'md' | 'sm'
    autocomplete?: string
  }>(),
  { type: 'text', invalid: false, disabled: false, monospace: false, size: 'md' },
)

const model = defineModel<string>({ default: '' })
</script>

<template>
  <input
    v-model="model"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :autocomplete="autocomplete"
    spellcheck="false"
    class="input"
    :class="[invalid && 'input--invalid', monospace && 'font-mono', size === 'sm' && 'input--sm']"
  />
</template>
