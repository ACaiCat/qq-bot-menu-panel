<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import { api } from '@/api/client'
import type { PanelRecord, TargetOp } from '@/api/types'
import AppButton from '@/components/ui/AppButton.vue'
import AppField from '@/components/ui/AppField.vue'
import AppIcon from '@/components/ui/AppIcon.vue'
import AppModal from '@/components/ui/AppModal.vue'
import AppTextarea from '@/components/ui/AppTextarea.vue'
import SegmentedControl from '@/components/ui/SegmentedControl.vue'
import { useToast } from '@/composables/useToast'
import { LIMITS, SCOPE_LABELS } from '@/utils/constants'
import { parseOpenids, validateTargets } from '@/utils/draft'

const props = defineProps<{ record: PanelRecord }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const toast = useToast()

const detail = ref<PanelRecord>(props.record)
const text = ref('')
const op = ref<TargetOp>('add')
const loading = ref(false)
const submitting = ref(false)

const opOptions: { value: TargetOp; label: string; icon: string }[] = [
  { value: 'add', label: '添加关联', icon: 'plus' },
  { value: 'del', label: '移除关联', icon: 'close' },
]

const isUserScope = computed(() => detail.value.scope === 'c2c')
const linked = computed(() =>
  isUserScope.value ? (detail.value.user_openids ?? []) : (detail.value.group_openids ?? []),
)
const openids = computed(() => parseOpenids(text.value))
const targetIssue = computed(() =>
  openids.value.length > 0 ? validateTargets(openids.value) : undefined,
)
const canSubmit = computed(
  () => openids.value.length > 0 && !targetIssue.value && !submitting.value,
)

async function loadDetail() {
  loading.value = true
  try {
    // 列表接口可能不带关联对象，这里拉一次详情拿最新数据
    detail.value = await api.getPanel(props.record.panel_id)
  } catch (error) {
    toast.failure(error)
  } finally {
    loading.value = false
  }
}

async function submit() {
  if (targetIssue.value) {
    toast.error(targetIssue.value)
    return
  }
  submitting.value = true
  try {
    await api.updatePanelTarget(detail.value.panel_id, {
      op: op.value,
      ...(isUserScope.value ? { user_openids: openids.value } : { group_openids: openids.value }),
    })
    toast.success(
      op.value === 'add' ? '已添加关联对象' : '已移除关联对象',
      `共 ${openids.value.length} 个`,
    )
    text.value = ''
    await loadDetail()
    emit('saved')
  } catch (error) {
    toast.failure(error)
  } finally {
    submitting.value = false
  }
}

onMounted(loadDetail)
</script>

<template>
  <AppModal
    title="管理关联对象"
    :subtitle="`${SCOPE_LABELS[detail.scope]} · 仅对下方 ${isUserScope ? '用户' : '群'} 生效`"
    size="md"
    @close="emit('close')"
  >
    <div class="flex flex-col gap-4">
      <div class="notice notice--accent">
        <AppIcon name="info" :size="15" class="mt-px shrink-0" />
        <span>
          只有「生效范围 = 仅指定对象」的面板才能调整关联对象；全局面板需要改为指定对象后才能添加。
        </span>
      </div>

      <section class="rounded-md border border-separator bg-surface-2 p-3">
        <div class="mb-2 flex items-center gap-2">
          <span class="text-[12.5px] font-semibold"
            >已关联的 {{ isUserScope ? '用户' : '群' }}</span
          >
          <span class="badge tabular-nums">{{ linked.length }}</span>
          <div class="flex-1" />
          <AppButton
            size="sm"
            variant="ghost"
            icon="refresh"
            :loading="loading"
            @click="loadDetail"
          >
            刷新
          </AppButton>
        </div>

        <p v-if="!linked.length" class="text-[12px] text-ink-subtle">
          当前没有关联对象，该面板不会对任何{{ isUserScope ? '用户' : '群' }}生效。
        </p>
        <ul v-else class="flex list-none flex-wrap gap-1.5 p-0">
          <li
            v-for="id in linked"
            :key="id"
            class="rounded-sm border border-separator bg-surface px-2 py-0.5 font-mono text-[11.5px] break-all"
          >
            {{ id }}
          </li>
        </ul>
      </section>

      <AppField label="操作" required>
        <div>
          <SegmentedControl v-model="op" :options="opOptions" />
        </div>
      </AppField>

      <AppField
        :label="isUserScope ? '用户 openid' : '群 openid'"
        required
        :current="openids.length"
        :max="LIMITS.targetOpenids"
        :hint="`每行一个或用逗号分隔，一次最多 ${LIMITS.targetOpenids} 个`"
        :issues="targetIssue ? [targetIssue] : []"
      >
        <AppTextarea
          v-model="text"
          :rows="4"
          :placeholder="isUserScope ? 'openid_user_001' : 'openid_group_001'"
        />
      </AppField>
    </div>

    <template #footer>
      <div class="flex-1" />
      <AppButton variant="ghost" :disabled="submitting" @click="emit('close')">关闭</AppButton>
      <AppButton
        :variant="op === 'del' ? 'danger' : 'primary'"
        :icon="op === 'del' ? 'close' : 'plus'"
        :loading="submitting"
        :disabled="!canSubmit"
        @click="submit"
      >
        {{ op === 'add' ? '添加关联' : '移除关联' }}
      </AppButton>
    </template>
  </AppModal>
</template>
