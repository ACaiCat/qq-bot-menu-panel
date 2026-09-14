<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue'

withDefaults(defineProps<{ icon?: string; title: string; desc?: string }>(), { icon: 'inbox' })
</script>

<template>
  <div class="empty">
    <div class="empty__glyph"><AppIcon :name="icon" :size="24" :stroke-width="1.5" /></div>
    <p class="empty__title">{{ title }}</p>
    <p v-if="desc" class="empty__desc">{{ desc }}</p>
    <slot />
  </div>
</template>
