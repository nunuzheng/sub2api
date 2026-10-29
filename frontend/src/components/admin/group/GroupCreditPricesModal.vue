<template>
  <BaseDialog :show="show" :title="t('admin.groups.form.creditPrices')" width="wide" @close="$emit('close')">
    <div v-if="group" class="space-y-4">
      <p class="text-sm text-gray-600 dark:text-gray-300">
        {{ group.name }} · ${{ formatPrice(group.credit_billing?.unit_price) }}/credit
      </p>
      <div class="flex items-end gap-2">
        <input v-model="searchQuery" class="input flex-1" :placeholder="t('admin.groups.searchUserPlaceholder')" @input="searchUsers" />
        <input
          v-model.number="newPrice"
          data-testid="group-credit-unit-price"
          type="number"
          min="0.00000001"
          max="1000"
          step="0.00000001"
          class="input w-36"
          placeholder="0.144"
        />
        <button type="button" class="btn btn-primary" :disabled="!selectedUser" @click="addLocal">{{ t('common.add') }}</button>
      </div>
      <div v-if="searchResults.length" class="rounded border border-gray-200 dark:border-dark-600">
        <button
          v-for="user in searchResults"
          :key="user.id"
          type="button"
          class="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-dark-700"
          @click="selectedUser = user"
        >
          #{{ user.id }} {{ user.username || user.email }}
        </button>
      </div>
      <p v-if="entries.length === 0" class="text-sm text-gray-500">{{ t('admin.groups.form.creditPricesEmpty') }}</p>
      <ul v-else class="divide-y divide-gray-100 dark:divide-dark-600">
        <li v-for="entry in entries" :key="entry.user_id" class="flex items-center justify-between py-2 text-sm">
          <span>#{{ entry.user_id }} {{ entry.user_email || entry.user_name }}</span>
          <span class="flex items-center gap-2">
            <input v-model.number="entry.credit_unit_price" type="number" min="0.00000001" max="1000" step="0.00000001" class="input w-32" />
            <button type="button" class="text-red-500" @click="remove(entry.user_id)">×</button>
          </span>
        </li>
      </ul>
      <div class="flex justify-end">
        <button type="button" class="btn btn-primary" :disabled="saving" @click="save">{{ t('common.save') }}</button>
      </div>
    </div>
  </BaseDialog>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import BaseDialog from '@/components/common/BaseDialog.vue'
import { adminAPI } from '@/api/admin'
import type { AdminGroup } from '@/types'
import type { GroupCreditPriceEntry } from '@/api/admin/groups'

const props = defineProps<{ show: boolean; group: AdminGroup | null }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()

const entries = ref<GroupCreditPriceEntry[]>([])
const searchQuery = ref('')
const searchResults = ref<Array<{ id: number; email: string; username?: string }>>([])
const selectedUser = ref<{ id: number; email: string; username?: string } | null>(null)
const newPrice = ref<number | null>(0.144)
const saving = ref(false)

const formatPrice = (value?: number) => {
  const price = Number(value)
  if (!Number.isFinite(price)) return '0'
  return price.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
}

watch(() => [props.show, props.group?.id] as const, async ([open, id]) => {
  if (!open || !id) return
  entries.value = await adminAPI.groups.getGroupCreditPrices(id)
})

const searchUsers = async () => {
  const q = searchQuery.value.trim()
  if (!q) {
    searchResults.value = []
    return
  }
  const res = await adminAPI.users.list(1, 8, { search: q })
  searchResults.value = res.items ?? []
}

const addLocal = () => {
  if (!selectedUser.value || newPrice.value == null) return
  if (newPrice.value < 1e-8 || newPrice.value > 1000) return
  const existing = entries.value.find((e) => e.user_id === selectedUser.value!.id)
  if (existing) {
    existing.credit_unit_price = newPrice.value
  } else {
    entries.value.push({
      user_id: selectedUser.value.id,
      user_name: selectedUser.value.username || '',
      user_email: selectedUser.value.email,
      credit_unit_price: newPrice.value
    })
  }
  selectedUser.value = null
  searchQuery.value = ''
  searchResults.value = []
}

const remove = (userID: number) => {
  entries.value = entries.value.filter((e) => e.user_id !== userID)
}

const save = async () => {
  if (!props.group) return
  saving.value = true
  try {
    await adminAPI.groups.replaceGroupCreditPrices(
      props.group.id,
      entries.value.map((e) => ({ user_id: e.user_id, credit_unit_price: e.credit_unit_price }))
    )
    emit('close')
  } finally {
    saving.value = false
  }
}
</script>
