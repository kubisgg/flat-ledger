<script setup lang="ts">
import type { Month } from '~/types'

const props = defineProps<{
  months: Month[]
  initialMonthId?: number
}>()

const emit = defineEmits<{ saved: [] }>()

const form = reactive<{
  monthId?: number
  name: string
  amount: number
  note: string
}>({
  monthId: props.initialMonthId || props.months[0]?.id,
  name: '',
  amount: 0,
  note: ''
})

async function save() {
  await $fetch('/api/payments', {
    method: 'POST',
    body: {
      ...form,
      isMetered: false,
      isManualAmount: true
    }
  })
  emit('saved')
  form.name = ''
  form.amount = 0
  form.note = ''
}
</script>

<template>
  <form
    class="space-y-4"
    @submit.prevent="save"
  >
    <UFormField label="Miesiąc">
      <USelect
        v-model="form.monthId"
        :items="months.map(month => ({ label: month.name, value: month.id }))"
        class="w-full"
      />
    </UFormField>
    <UFormField label="Nazwa">
      <UInput
        v-model="form.name"
        required
        class="w-full"
      />
    </UFormField>
    <UFormField label="Kwota">
      <UInput
        v-model.number="form.amount"
        type="number"
        step="0.01"
        class="w-full"
      />
    </UFormField>
    <UFormField label="Notatka">
      <UTextarea
        v-model="form.note"
        class="w-full"
      />
    </UFormField>
    <UButton
      type="submit"
      icon="i-lucide-plus"
      block
    >
      Dodaj opłatę
    </UButton>
  </form>
</template>
