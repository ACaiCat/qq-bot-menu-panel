<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import AppButton from '@/components/ui/AppButton.vue'
import AppField from '@/components/ui/AppField.vue'
import AppInput from '@/components/ui/AppInput.vue'
import { useConnection } from '@/composables/useConnection'
import { useScrollEdge } from '@/composables/useScrollEdge'
import { useToast } from '@/composables/useToast'
import { formatDuration } from '@/utils/format'

const toast = useToast()
const { state, refresh, save, clear } = useConnection()
const scrolled = useScrollEdge()

const appId = ref('')
const secret = ref('')
const confirmingClear = ref(false)

const status = computed(() => state.status)
const sourceLabel = computed(() => {
  switch (status.value?.source) {
    case 'ui':
      return '本页面保存'
    case 'file':
      return '.qqbot.local.json'
    case 'env':
      return '环境变量'
    default:
      return '未配置'
  }
})

const canSubmit = computed(() => appId.value.trim().length > 0 && secret.value.trim().length > 0)

async function onSubmit() {
  if (!canSubmit.value) return
  try {
    await save(appId.value.trim(), secret.value.trim())
    secret.value = ''
    toast.success('凭证已保存', 'access_token 校验通过，可以开始配置菜单与面板了')
  } catch (error) {
    toast.failure(error)
  }
}

async function onClear() {
  try {
    await clear()
    appId.value = ''
    secret.value = ''
    confirmingClear.value = false
    toast.info('已清除本地凭证')
  } catch (error) {
    toast.failure(error)
  }
}

onMounted(async () => {
  try {
    await refresh()
  } catch (error) {
    toast.failure(error)
  }
  appId.value = status.value?.appId ?? ''
})
</script>

<template>
  <div>
    <header class="page-bar" :class="scrolled && 'page-bar--scrolled'">
      <div class="page-bar__inner">
        <div class="page-bar__heading">
          <h1 class="page-title">设置</h1>
          <p class="page-desc">
            凭证只保存在本机，由本地 Node 服务用于换取 access_token，不会写入浏览器存储。
          </p>
        </div>
      </div>
    </header>

    <div class="page-body">
      <div class="flex max-w-[760px] flex-col gap-4">
        <section class="card">
          <div class="card__header">
            <span class="card__title">机器人凭证</span>
            <div class="flex-1" />
            <span
              v-if="status"
              class="badge"
              :class="status.configured ? 'badge--success' : 'badge--danger'"
            >
              <span class="badge__dot" />
              {{ status.configured ? '已配置' : '未配置' }}
            </span>
          </div>

          <div class="card__body flex flex-col gap-4">
            <div class="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
              <AppField label="AppID" required hint="开放平台管理端「开发设置」中获取">
                <AppInput v-model="appId" placeholder="例如：102014201" monospace />
              </AppField>

              <AppField label="AppSecret" required hint="仅提交给本地服务，不会回传到浏览器">
                <AppInput
                  v-model="secret"
                  type="password"
                  placeholder="请输入 AppSecret"
                  autocomplete="off"
                  monospace
                />
              </AppField>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <AppButton
                variant="primary"
                icon="shield"
                :loading="state.saving"
                :disabled="!canSubmit"
                @click="onSubmit"
              >
                保存并校验
              </AppButton>
              <AppButton variant="ghost" icon="refresh" :loading="state.loading" @click="refresh">
                刷新状态
              </AppButton>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card__header">
            <span class="card__title">连接状态</span>
          </div>

          <div class="card__body">
            <dl class="flex flex-col gap-2.5">
              <div class="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 text-[12.5px]">
                <dt class="text-ink-muted">凭证来源</dt>
                <dd>{{ sourceLabel }}</dd>
              </div>
              <div class="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 text-[12.5px]">
                <dt class="text-ink-muted">AppID</dt>
                <dd class="font-mono break-all">{{ status?.appId ?? '—' }}</dd>
              </div>
              <div class="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 text-[12.5px]">
                <dt class="text-ink-muted">access_token</dt>
                <dd>
                  <span v-if="status?.token.valid" class="badge badge--success">
                    <span class="badge__dot" />
                    有效 · 剩余 {{ formatDuration(status.token.expiresIn) }}
                  </span>
                  <span v-else class="badge">尚未获取，或已过期（下次请求会自动刷新）</span>
                </dd>
              </div>
              <div class="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 text-[12.5px]">
                <dt class="text-ink-muted">接口地址</dt>
                <dd class="font-mono break-all">https://api.bot.qq.com</dd>
              </div>
            </dl>
          </div>
        </section>

        <section class="card border-danger/35">
          <div class="card__header">
            <span class="card__title text-danger-ink">清除本地凭证</span>
          </div>

          <div class="card__body">
            <p class="text-[12.5px] text-ink-muted">
              删除 <code>.qqbot.local.json</code> 并丢弃内存中的 access_token。已下发到 QQ
              服务器的菜单与面板配置不会被改动。
            </p>

            <div v-if="confirmingClear" class="mt-3 flex flex-wrap items-center gap-2">
              <span class="text-[12.5px] text-ink-muted">确认清除？</span>
              <AppButton variant="danger" size="sm" :loading="state.saving" @click="onClear">
                确认清除
              </AppButton>
              <AppButton variant="ghost" size="sm" @click="confirmingClear = false">取消</AppButton>
            </div>
            <AppButton
              v-else
              class="mt-3"
              variant="danger"
              icon="trash"
              :disabled="!status?.configured"
              @click="confirmingClear = true"
            >
              清除凭证
            </AppButton>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
