<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue'

defineProps<{ issues: string[]; title?: string }>()
</script>

<template>
  <div v-if="issues.length" class="notice notice--danger">
    <AppIcon name="warning" :size="15" class="mt-0.5 shrink-0" />
    <div class="min-w-0">
      <strong v-if="title">{{ title }}</strong>
      <ul class="issue-list" :class="title && 'mt-1'">
        <li v-for="issue in issues" :key="issue" class="issue-list__item">
          <span class="mt-[7px] size-1 shrink-0 rounded-full bg-current" />
          <span>{{ issue }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
