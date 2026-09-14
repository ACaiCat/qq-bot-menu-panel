<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

import AppButton from '@/components/ui/AppButton.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppToasts from '@/components/ui/AppToasts.vue'
import { useConnection } from '@/composables/useConnection'
import { useToast } from '@/composables/useToast'
import MenuView from '@/views/MenuView.vue'
import PanelsView from '@/views/PanelsView.vue'
import SettingsView from '@/views/SettingsView.vue'

type ViewKey = 'menu' | 'panels' | 'settings'

const NAV = [
  { key: 'menu', label: '自定义菜单', icon: 'menu' },
  { key: 'panels', label: '指令面板', icon: 'panels' },
  { key: 'settings', label: '设置', icon: 'settings' },
] as const satisfies readonly { key: ViewKey; label: string; icon: string }[]

const VIEWS: Record<ViewKey, unknown> = {
  menu: MenuView,
  panels: PanelsView,
  settings: SettingsView,
}

const VIEW_KEYS: ViewKey[] = ['menu', 'panels', 'settings']

/** 用 hash 记录当前视图，刷新后仍停留在原页面 */
function readHash(): ViewKey {
  const key = window.location.hash.replace(/^#\/?/, '')
  return (VIEW_KEYS as string[]).includes(key) ? (key as ViewKey) : 'menu'
}

const active = ref<ViewKey>(readHash())
const toast = useToast()
const { state, refresh } = useConnection()

const configured = computed(() => state.status?.configured ?? false)

watch(active, (key) => {
  if (window.location.hash !== `#/${key}`) window.location.hash = `#/${key}`
})

function syncFromHash() {
  active.value = readHash()
}

onMounted(async () => {
  window.addEventListener('hashchange', syncFromHash)
  try {
    await refresh()
  } catch (error) {
    toast.failure(error)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('hashchange', syncFromHash)
})
</script>

<template>
  <div class="min-h-dvh">
    <!-- 侧栏是「浮」在内容之上的一层材质：内容从它下面滚过去，而不是被一条实心栏切掉 -->
    <aside
      class="material fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-separator max-lg:inset-x-0 max-lg:inset-y-auto max-lg:top-0 max-lg:h-14 max-lg:w-auto max-lg:flex-row max-lg:items-center max-lg:gap-1 max-lg:border-r-0 max-lg:border-b max-lg:px-3"
    >
      <div class="flex items-center gap-2.5 px-4.5 py-4 max-lg:p-0 max-lg:pr-3">
        <span
          class="grid size-8 flex-none place-items-center rounded-md bg-accent text-white shadow-xs"
        >
          <AppIcon name="message" :size="17" />
        </span>
        <div class="min-w-0 max-lg:hidden">
          <div class="text-[13.5px] font-[620] tracking-title">QQ 机器人</div>
          <div class="text-[11.5px] text-ink-subtle">菜单与指令面板</div>
        </div>
      </div>

      <nav class="flex flex-1 flex-col gap-0.5 px-3 max-lg:flex-row max-lg:gap-1 max-lg:px-0">
        <button
          v-for="item in NAV"
          :key="item.key"
          type="button"
          class="nav-item max-lg:w-auto"
          :class="active === item.key && 'nav-item--active'"
          :aria-current="active === item.key ? 'page' : undefined"
          @click="active = item.key"
        >
          <AppIcon :name="item.icon" :size="16" class="flex-none" />
          {{ item.label }}
        </button>
      </nav>

      <div class="px-3 pb-3 max-lg:hidden">
        <button
          type="button"
          class="flex w-full cursor-pointer flex-col items-start gap-1.5 rounded-md p-2 text-left transition-colors duration-150 hover:bg-surface-3"
          @click="active = 'settings'"
        >
          <span class="badge" :class="configured ? 'badge--success' : 'badge--danger'">
            <span class="badge__dot" />
            {{ configured ? '已连接' : '未配置' }}
          </span>
          <span class="w-full truncate font-mono text-[11px] text-ink-subtle">
            {{ state.status?.appId ?? '去设置凭证' }}
          </span>
        </button>
      </div>
    </aside>

    <main class="max-lg:pt-14 lg:pl-[248px]">
      <div
        v-if="state.status && !configured"
        class="flex flex-wrap items-center gap-3 border-b border-warning/30 bg-warning-soft px-7 py-2.5 text-[12.5px] text-warning-ink max-sm:px-4"
      >
        <AppIcon name="warning" :size="15" class="flex-none" />
        <span>还没有配置 AppID / AppSecret，菜单与面板接口无法调用。</span>
        <AppButton class="ml-auto" variant="primary" size="sm" @click="active = 'settings'">
          前往设置
        </AppButton>
      </div>

      <component :is="VIEWS[active]" />
    </main>

    <AppToasts />
  </div>
</template>
