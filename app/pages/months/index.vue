<script setup lang="ts">
const page = ref(1)
const { data: months, refresh } = await useFetch('/api/months', {
  default: () => ({ data: [], total: 0 }),
  query: { page }
})
const { data: types } = await useFetch('/api/payment-types', { default: () => [] })

const polishMonths = [
  'Styczeń',
  'Luty',
  'Marzec',
  'Kwiecień',
  'Maj',
  'Czerwiec',
  'Lipiec',
  'Sierpień',
  'Wrzesień',
  'Październik',
  'Listopad',
  'Grudzień'
]
const currentDate = new Date()
const form = reactive({
  name: '',
  year: currentDate.getFullYear(),
  month: currentDate.getMonth() + 1,
  note: '',
  currentReadings: {} as Record<string, number>,
  variableAmounts: {} as Record<string, number>
})

function buildMonthName(month: number, year: number) {
  return `${polishMonths[month - 1] || 'miesiąc'} ${year}`
}

form.name = buildMonthName(form.month, form.year)

watch(
  () => [form.month, form.year],
  () => {
    form.name = buildMonthName(Number(form.month), Number(form.year))
  }
)

const toast = useToast()

async function createMonth() {
  try {
    await $fetch('/api/months', { method: 'POST', body: form })
    form.name = buildMonthName(form.month, form.year)
    form.note = ''
    form.currentReadings = {}
    form.variableAmounts = {}
    await refresh()
  }
  catch (err: any) {
    toast.add({
      title: err?.data?.message || 'Błąd',
      color: 'error'
    })
  }
}

const deleteMonthId = ref<number | null>(null)

async function confirmRemoveMonth() {
  if (deleteMonthId.value === null) return
  await $fetch(`/api/months/${deleteMonthId.value}`, { method: 'DELETE' })
  deleteMonthId.value = null
  await refresh()
}
</script>

<template>
  <div class="grid gap-6 pb-20 lg:grid-cols-[360px_1fr] md:pb-0 lg:items-start">
    <UCard class="bg-white/5 ring-white/10">
      <template #header>
        <h1 class="text-xl font-semibold">
          Nowy miesiąc
        </h1>
      </template>
      <form
        class="space-y-4"
        @submit.prevent="createMonth"
      >
        <UFormField label="Nazwa">
          <UInput
            v-model="form.name"
            required
            class="w-full"
          />
        </UFormField>
        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Rok">
            <UInput
              v-model.number="form.year"
              type="number"
              required
              class="w-full"
            />
          </UFormField>
          <UFormField label="Miesiąc">
            <UInput
              v-model.number="form.month"
              type="number"
              min="1"
              max="12"
              required
              class="w-full"
            />
          </UFormField>
        </div>
        <UFormField label="Notatka">
          <UTextarea
            v-model="form.note"
            class="w-full"
          />
        </UFormField>
        <div
          v-if="types.some(type => type.isMetered)"
          class="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3"
        >
          <p class="text-sm font-medium text-stone-200">
            Aktualne liczniki
          </p>
          <UFormField
            v-for="type in types.filter(item => item.isMetered)"
            :key="type.id"
            :label="`${type.name}${type.unit ? ` (${type.unit})` : ''}`"
          >
            <UInput
              v-model.number="form.currentReadings[String(type.id)]"
              type="number"
              step="1"
              class="w-full"
            />
          </UFormField>
        </div>
        <div
          v-if="types.some(type => type.kind === 'variable')"
          class="space-y-3 rounded-lg border border-white/10 bg-white/5 p-3"
        >
          <p class="text-sm font-medium text-stone-200">
            Kwoty wpisywane w miesiacu
          </p>
          <UFormField
            v-for="type in types.filter(item => item.kind === 'variable')"
            :key="type.id"
            :label="type.name"
          >
            <UInput
              v-model.number="form.variableAmounts[String(type.id)]"
              type="number"
              step="0.01"
              class="w-full"
            />
          </UFormField>
        </div>
        <UButton
          type="submit"
          icon="i-lucide-plus"
          block
        >
          Dodaj miesiac
        </UButton>
      </form>
    </UCard>

    <UCard class="bg-white/5 ring-white/10">
      <template #header>
        <h2 class="text-xl font-semibold">
          Miesiące
        </h2>
      </template>
      <div class="space-y-3">
        <div
          v-for="month in months.data"
          :key="month.id"
          class="flex flex-col gap-3 rounded-lg border border-white/10 bg-stone-950/40 p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <NuxtLink
            :to="`/months/${month.id}`"
            class="min-w-0"
          >
            <p class="font-medium">{{ month.name }}</p>
            <div class="flex items-center gap-2 text-sm text-muted">
              <span>{{ String(month.month).padStart(2, '0') }}.{{ month.year }}</span>
              <template v-if="month.isClosed">
                <span>·</span>
                <UBadge color="success" variant="subtle" size="sm">zamknięty</UBadge>
              </template>
            </div>
          </NuxtLink>
          <div class="flex items-center gap-2">
            <UButton
              :to="`/months/${month.id}`"
              icon="i-lucide-eye"
              color="neutral"
              variant="soft"
            >
              Otwórz
            </UButton>
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              @click="deleteMonthId = month.id"
            />
          </div>
        </div>
        <p
          v-if="!months.data.length"
          class="py-10 text-center text-muted"
        >
          Brak dodanych miesięcy.
        </p>
      </div>
      <div
        v-if="months.total > 10"
        class="mt-4 flex justify-center"
      >
        <UPagination
          v-model:page="page"
          :total="months.total"
          :items-per-page="10"
        />
      </div>
    </UCard>
  </div>

  <UModal
    :open="deleteMonthId !== null"
    title="Usuń miesiąc"
    description="Tej operacji nie można cofnąć."
    :dismissible="false"
    :ui="{ footer: 'justify-end' }"
    @update:open="deleteMonthId = null"
  >
    <template #footer>
      <UButton label="Anuluj" color="neutral" variant="outline" @click="deleteMonthId = null" />
      <UButton label="Usuń" color="error" @click="confirmRemoveMonth" />
    </template>
  </UModal>
</template>
