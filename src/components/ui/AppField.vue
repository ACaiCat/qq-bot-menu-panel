<script setup lang="ts">
withDefaults(
  defineProps<{
    label?: string
    hint?: string
    required?: boolean
    /** 当前字符数 / 上限，传入后右侧显示计数器（中文按 2 字符计） */
    current?: number
    max?: number
    issues?: string[]
  }>(),
  { required: false, issues: () => [] },
)
</script>

<template>
  <div class="flex min-w-0 flex-col gap-1.5">
    <div v-if="label || max !== undefined" class="field__label">
      <span v-if="label">
        {{ label }}
        <span v-if="required" class="text-danger" aria-hidden="true">*</span>
      </span>
      <span
        v-if="max !== undefined"
        class="field__counter"
        :class="{ 'field__counter--over': (current ?? 0) > max }"
      >
        {{ current ?? 0 }}/{{ max }}
      </span>
    </div>

    <slot />

    <div v-if="hint" class="field__meta">{{ hint }}</div>

    <ul v-if="issues.length" class="issue-list">
      <li v-for="issue in issues" :key="issue" class="issue-list__item text-danger-ink">
        <span class="mt-[7px] size-1 shrink-0 rounded-full bg-current" />
        <span>{{ issue }}</span>
      </li>
    </ul>
  </div>
</template>
