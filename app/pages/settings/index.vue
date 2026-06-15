<script setup lang="ts">
import type { PaymentType } from '~/types'

const toast = useToast()
const { data: types, refresh } = await useFetch('/api/payment-types', { default: () => [] })
const { data: settings, refresh: refreshSettings } = await useFetch('/api/settings', {
  default: () => ({ transferTitle: 'en. {energia}, zw. {woda}' })
})
const form = reactive({
  name: '',
  kind: 'fixed' as 'fixed' | 'metered' | 'variable',
  isRequired: true,
  defaultActive: false,
  defaultAmount: 0,
  unitPrice: 0,
  unit: '',
  notes: ''
})
const settingsForm = reactive({
  transferTitle: settings.value.transferTitle
})

async function createType() {
  await $fetch('/api/payment-types', { method: 'POST', body: form })
  form.name = ''
  form.kind = 'fixed'
  form.isRequired = true
  form.defaultActive = false
  form.defaultAmount = 0
  form.unitPrice = 0
  form.unit = ''
  form.notes = ''
  await refresh()
}

async function updateType(type: PaymentType) {
  await $fetch(`/api/payment-types/${type.id}`, { method: 'PUT', body: type })
  await refresh()
  toast.add({ title: 'Zapisano opłatę', color: 'success' })
}

async function removeType(id: number) {
  await $fetch(`/api/payment-types/${id}`, { method: 'DELETE' })
  await refresh()
}

async function saveSettings() {
  await $fetch('/api/settings', { method: 'PUT', body: settingsForm })
  await refreshSettings()
  toast.add({ title: 'Zapisano ustawienia przelewu', color: 'success' })
}
</script>

<template>
  <div class="grid gap-6 pb-20 lg:grid-cols-[360px_1fr] md:pb-0">
    <div class="space-y-6">
      <UCard class="bg-[#21222c] ring-1 ring-[#44475a]/60 shadow-lg shadow-black/40">
        <template #header>
          <div>
            <h1 class="text-xl font-semibold text-stone-50">
              Nowa opłata
            </h1>
          </div>
        </template>

        <form
          class="space-y-4"
          @submit.prevent="createType"
        >
          <UFormField label="Nazwa">
            <UInput
              v-model="form.name"
              required
              class="w-full"
            />
          </UFormField>
          <UFormField label="Typ">
            <select
              v-model="form.kind"
              class="w-full rounded-md border border-[#44475a]/60 bg-default px-3 py-2 text-sm text-[#f8f8f2] outline-none focus:border-primary-400"
            >
              <option value="fixed">
                Stała kwota
              </option>
              <option value="metered">
                Licznikowa
              </option>
              <option value="variable">
                Kwota wpisywana
              </option>
            </select>
          </UFormField>
          <div class="flex flex-wrap gap-4">
            <UCheckbox
              v-model="form.isRequired"
              label="Obowiązkowa"
            />
            <UCheckbox
              v-model="form.defaultActive"
              label="Domyślnie aktywna"
              :disabled="form.isRequired"
            />
          </div>
          <UFormField :label="form.kind === 'metered' ? 'Stawka za jednostkę' : 'Domyślna kwota'">
            <UInput
              v-if="form.kind === 'metered'"
              v-model.number="form.unitPrice"
              type="number"
              step="0.0001"
              class="w-full"
            />
            <UInput
              v-else
              v-model.number="form.defaultAmount"
              type="number"
              step="0.01"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="form.kind === 'metered'"
            label="Jednostka"
          >
            <UInput
              v-model="form.unit"
              placeholder="kWh, m3"
              class="w-full"
            />
          </UFormField>
          <UButton
            type="submit"
            icon="i-lucide-plus"
            block
          >
            Dodaj
          </UButton>
        </form>
      </UCard>

      <UCard class="bg-[#21222c] ring-1 ring-[#44475a]/60 shadow-lg shadow-black/40">
        <template #header>
          <div>
            <h2 class="text-xl font-semibold text-stone-50">
              Ustawienia przelewu
            </h2>
          </div>
        </template>

        <form
          class="grid gap-3 md:grid-cols-[1fr_auto] md:items-end"
          @submit.prevent="saveSettings"
        >
          <UFormField label="Tytuł przelewu">
            <UInput
              v-model="settingsForm.transferTitle"
              placeholder="en. {energia}, w. {woda}"
              class="w-full"
            />
          </UFormField>
          <UButton
            type="submit"
            icon="i-lucide-save"
          >
            Zapisz
          </UButton>
        </form>
      </UCard>
    </div>

    <UCard class="bg-[#21222c] ring-1 ring-[#44475a]/60 shadow-lg shadow-black/40">
      <template #header>
        <div>
          <p class="text-sm text-stone-400">
            Pozycje dodawane automatycznie do nowego miesiąca
          </p>
          <h2 class="text-xl font-semibold text-stone-50">
            Ustawienia opłat
          </h2>
        </div>
      </template>

      <div class="space-y-3">
        <PaymentTypeSettingsRow
          v-for="type in types"
          :key="type.id"
          :type="type"
          @save="updateType"
          @remove="removeType"
        />
      </div>
    </UCard>
  </div>
</template>
