<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'

import AppIcon from '@/components/ui/AppIcon.vue'

withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    size?: 'sm' | 'md' | 'wide'
    closeOnMask?: boolean
  }>(),
  { size: 'md', closeOnMask: true },
)

const emit = defineEmits<{ close: [] }>()

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div class="modal-mask" @click.self="closeOnMask && emit('close')">
      <div
        class="modal material-strong"
        :class="`modal--${size}`"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
      >
        <header class="modal__header">
          <div class="min-w-0">
            <h2 class="modal__title">{{ title }}</h2>
            <p v-if="subtitle" class="modal__subtitle">{{ subtitle }}</p>
          </div>
          <div class="flex-1" />
          <button
            type="button"
            class="btn btn--ghost btn--sm btn--icon"
            aria-label="关闭"
            @click="emit('close')"
          >
            <AppIcon name="close" :size="15" />
          </button>
        </header>

        <div class="modal__body">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="modal__footer">
          <slot name="footer" />
        </footer>
      </div>
    </div>
  </Teleport>
</template>
