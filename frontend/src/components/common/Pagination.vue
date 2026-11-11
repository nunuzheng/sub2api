<template>
  <nav class="pager" :aria-label="t('pagination.page')">
    <div v-if="showPageSizeSelector || showJump" class="pager-tools">
      <label v-if="showPageSizeSelector" class="pager-size">
        <span class="sr-only">{{ t('pagination.perPage') }}</span>
        <select :value="pageSize" @change="onSizeChange">
          <option v-for="option in pageSizeSelectOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>
      <div v-if="showJump" class="pager-jump">
        <label class="sr-only" for="pager-jump">{{ t('pagination.jumpTo') }}</label>
        <input
          id="pager-jump"
          v-model="jumpPage"
          type="number"
          min="1"
          :max="totalPages"
          :placeholder="t('pagination.jumpPlaceholder')"
          @keyup.enter="submitJump"
        />
        <button type="button" class="btn btn-ghost btn-sm" @click="submitJump">{{ t('pagination.jumpAction') }}</button>
      </div>
    </div>
    <div class="pager-bar">
      <button
        type="button"
        class="pager-btn"
        :disabled="disabled || page <= 1"
        @click="goToPage(page - 1)"
      >{{ t('pagination.previous') }}</button>
      <span class="pager-index">{{ currentIndex }} / {{ pageCountLabel }}</span>
      <button
        type="button"
        class="pager-btn"
        :disabled="disabled || !canGoNext"
        @click="goToPage(page + 1)"
      >{{ t('pagination.next') }}</button>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { getConfiguredTablePageSizeOptions, normalizeTablePageSize } from '@/utils/tablePreferences'
import { setPersistedPageSize } from '@/composables/usePersistedPageSize'

const { t } = useI18n()

interface Props {
  total: number
  page: number
  pageSize: number
  pageSizeOptions?: number[]
  showPageSizeSelector?: boolean
  showJump?: boolean
  disabled?: boolean
}

interface Emits {
  (e: 'update:page', page: number): void
  (e: 'update:pageSize', pageSize: number): void
}

const props = withDefaults(defineProps<Props>(), {
  pageSizeOptions: () => getConfiguredTablePageSizeOptions(),
  showPageSizeSelector: true,
  showJump: false,
  disabled: false
})

const emit = defineEmits<Emits>()
const jumpPage = ref('')

const totalPages = computed(() => {
  if (props.pageSize <= 0) return 0
  return Math.ceil(props.total / props.pageSize)
})
const pageCountLabel = computed(() => Math.max(totalPages.value, 1))
const currentIndex = computed(() => (props.total === 0 ? 0 : props.page))
const canGoNext = computed(() => totalPages.value > 0 && props.page < totalPages.value)

const pageSizeSelectOptions = computed(() => {
  const configured = props.pageSizeOptions.length > 0
    ? props.pageSizeOptions
    : getConfiguredTablePageSizeOptions()
  const options = Array.from(
    new Set([...configured, normalizeTablePageSize(props.pageSize)])
  ).sort((a, b) => a - b)
  return options.map((size) => ({ value: size, label: String(size) }))
})

const goToPage = (newPage: number) => {
  if (props.disabled) return
  if (newPage >= 1 && newPage <= totalPages.value && newPage !== props.page) {
    emit('update:page', newPage)
  }
}

const onSizeChange = (event: Event) => {
  const newPageSize = normalizeTablePageSize(Number((event.target as HTMLSelectElement).value))
  setPersistedPageSize(newPageSize)
  emit('update:pageSize', newPageSize)
}

const submitJump = () => {
  const value = String(jumpPage.value).trim()
  if (!value) return
  const pageNum = Number.parseInt(value, 10)
  if (Number.isNaN(pageNum)) return
  const nextPage = Math.min(Math.max(pageNum, 1), totalPages.value)
  jumpPage.value = ''
  goToPage(nextPage)
}
</script>

<style scoped>
.pager-tools {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.5rem;
  padding: 8px 20px 0;
}

.pager-size select,
.pager-jump input {
  height: 32px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  font-size: 13px;
  padding: 0 8px;
}

.pager-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 20px;
  border-top: 1px solid var(--line);
}

.pager-btn {
  height: 32px;
  min-width: 63px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  font-size: 13px;
  font-weight: 550;
  opacity: 0.4;
}

.pager-btn:not(:disabled) {
  opacity: 1;
  border-color: #171717;
  background: #171717;
  color: #fff;
}

.dark .pager-btn:not(:disabled) {
  border-color: #f4f4f5;
  background: #f4f4f5;
  color: #111;
}

.pager-btn:disabled {
  cursor: not-allowed;
}

.pager-index {
  color: #6b6b73;
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

.dark .pager-index {
  color: #a1a1aa;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
