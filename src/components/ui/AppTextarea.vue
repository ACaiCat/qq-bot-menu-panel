<script setup lang="ts">
withDefaults(
  defineProps<{
    placeholder?: string
    rows?: number
    invalid?: boolean
    disabled?: boolean
  }>(),
  { rows: 3, invalid: false, disabled: false },
)

const model = defineModel<string>({ default: '' })
</script>

<template>
  <textarea
    v-model="model"
    :rows="rows"
    :placeholder="placeholder"
    :disabled="disabled"
    spellcheck="false"
    class="textarea"
    :class="invalid && 'textarea--invalid'"
  />
</template>
