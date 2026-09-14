<script setup lang="ts">
withDefaults(defineProps<{ label?: string; disabled?: boolean }>(), { disabled: false })

const model = defineModel<boolean>({ default: false })
</script>

<template>
  <label class="switch">
    <input v-model="model" type="checkbox" :disabled="disabled" />
    <span class="switch__track"><span class="switch__thumb" /></span>
    <span v-if="label" class="switch__label">{{ label }}</span>
  </label>
</template>
