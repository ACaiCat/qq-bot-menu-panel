<script setup lang="ts">
import AppIcon from '@/components/ui/AppIcon.vue'
import { useToast, type ToastType } from '@/composables/useToast'

const { items, dismiss } = useToast()

const META: Record<ToastType, { icon: string; tone: string }> = {
  success: { icon: 'success', tone: 'text-success-ink' },
  error: { icon: 'error', tone: 'text-danger-ink' },
  info: { icon: 'info', tone: 'text-accent-ink' },
}
</script>

<template>
  <Teleport to="body">
    <div class="toasts" aria-live="polite">
      <div
        v-for="toast in items"
        :key="toast.id"
        class="toast material-strong"
        role="status"
        @click="dismiss(toast.id)"
      >
        <AppIcon
          :name="META[toast.type].icon"
          :size="16"
          class="mt-px shrink-0"
          :class="META[toast.type].tone"
        />
        <div class="min-w-0">
          <div class="toast__title">{{ toast.title }}</div>
          <div v-if="toast.detail" class="toast__detail">{{ toast.detail }}</div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
