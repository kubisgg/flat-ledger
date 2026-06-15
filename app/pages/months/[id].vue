<script setup lang="ts">
interface MonthPayment {
  id: number
  name: string
  amount: number
  isRequired: boolean
  note?: string | null
  type?: {
    kind?: 'fixed' | 'metered' | 'variable'
    isMetered?: boolean
  } | null
  meter?: {
    currentValue: number
    previousValue: number
    unitPrice: number
  } | null
}

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { formatMoney, formatExact } = useMoney()
const { data, refresh } = await useFetch(`/api/months/${route.params.id}`)
const { data: settings } = await useFetch('/api/settings', {
  default: () => ({ transferTitle: 'en. {energia}, zw. {woda}' })
})
const readings = reactive<Record<string, number>>({})
const variableAmounts = reactive<Record<string, number>>({})
const notes = reactive<Record<string, string>>({})

const meteredPayments = computed(() => data.value?.payments.filter(payment => payment.type?.isMetered) || [])
const editablePayments = computed(() => data.value?.payments.filter(payment => payment.type?.isMetered || payment.type?.kind === 'variable' || !payment.type) || [])
const floorMoney = (value: number) => Math.floor(value * 100) / 100
const slug = (value: string) => value.toLowerCase()
  .replace(/\u0142/g, 'l').replace(/\u017a/g, 'z').replace(/\u017c/g, 'z')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
const paymentAmount = (payment: MonthPayment) => {
  if (!payment.isRequired) {
    return 0
  }

  if (payment.meter) {
    const currentValue = readings[String(payment.id)] ?? payment.meter.currentValue
    const usage = Math.max(currentValue - payment.meter.previousValue, 0)
    return floorMoney(usage * payment.meter.unitPrice)
  }

  if (payment.type?.kind === 'variable') {
    return floorMoney(variableAmounts[String(payment.id)] ?? payment.amount)
  }

  return payment.amount
}
const liveTotal = computed(() => (data.value?.payments || []).reduce((sum, payment) => {
  return sum + paymentAmount(payment)
}, 0))
const transferTitle = computed(() => {
  const rows = data.value?.payments || []
  const values = new Map<string, string>()

  for (const payment of rows) {
    if (!payment.meter) continue
    const currentValue = readings[String(payment.id)] ?? payment.meter.currentValue
    values.set(slug(payment.name), String(currentValue))
  }

  return (settings.value.transferTitle || '').replace(/\{([^}]+)\}/g, (_, key: string) => values.get(slug(key)) || '')
})

watchEffect(() => {
  for (const payment of meteredPayments.value) {
    if (readings[String(payment.id)] === undefined) {
      readings[String(payment.id)] = payment.meter?.currentValue || 0
    }
  }

  for (const payment of data.value?.payments || []) {
    if ((payment.type?.kind === 'variable' || !payment.type) && variableAmounts[String(payment.id)] === undefined) {
      variableAmounts[String(payment.id)] = payment.amount || 0
    }
    if (notes[String(payment.id)] === undefined) {
      notes[String(payment.id)] = payment.note || ''
    }
  }
})

async function saveReadings() {
  if (!data.value?.month) return
  await $fetch(`/api/months/${data.value.month.id}/readings`, {
    method: 'PUT',
    body: { currentReadings: readings, variableAmounts, notes }
  })
  await refresh()
  toast.add({ title: 'Zapisano rozliczenie', color: 'success' })
  await router.push('/months')
}

async function togglePaid() {
  if (!data.value?.month) return
  await $fetch(`/api/months/${data.value.month.id}`, {
    method: 'PUT',
    body: { ...data.value.month, isClosed: !data.value.month.isClosed }
  })
  await refresh()
}

async function toggleRequired(paymentId: number, isRequired: boolean) {
  await $fetch(`/api/payments/${paymentId}/required`, {
    method: 'PUT',
    body: { isRequired }
  })
  await refresh()
}
</script>

<template>
  <div class="space-y-6 pb-20 md:pb-0">
    <UCard class="bg-white/5 ring-white/10">
      <template #header>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p class="text-sm text-stone-400">
              Miesiac
            </p>
            <h1 class="text-2xl font-semibold text-stone-50">
              {{ data?.month.name }}
            </h1>
          </div>
          <UButton
            :icon="data?.month.isClosed ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
            :color="data?.month.isClosed ? 'success' : 'neutral'"
            variant="subtle"
            @click="togglePaid"
          >
            {{ data?.month.isClosed ? 'Opłacony' : 'Oznacz jako opłacony' }}
          </UButton>
        </div>
      </template>

      <div class="grid gap-4 md:grid-cols-3">
        <div>
          <p class="text-sm text-stone-400">
            Do zapłaty razem
          </p>
          <p class="text-3xl font-semibold text-stone-50">
            {{ formatMoney(liveTotal) }}
          </p>
        </div>
        <div>
          <p class="text-sm text-stone-400">
            Status
          </p>
          <UBadge
            :color="data?.month.isClosed ? 'success' : 'warning'"
            variant="subtle"
            class="mt-2"
          >
            {{ data?.month.isClosed ? 'opłacony' : 'do zapłaty' }}
          </UBadge>
        </div>
        <div>
          <p class="text-sm text-stone-400">
            Tytuł przelewu
          </p>
          <p class="mt-1 text-stone-200">
            {{ transferTitle || 'brak' }}
          </p>
        </div>
      </div>
    </UCard>

    <UCard class="bg-white/5 ring-white/10">
      <template #header>
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 class="text-xl font-semibold text-stone-50">
              Rozliczenie
            </h2>
          </div>
          <UButton
            v-if="editablePayments.length"
            icon="i-lucide-save"
            @click="saveReadings"
          >
            Zapisz rozliczenie
          </UButton>
        </div>
      </template>

      <div class="overflow-x-auto">
        <table class="w-full min-w-215 text-sm">
          <thead class="text-left text-stone-400">
            <tr class="border-b border-white/10">
              <th class="py-3 pr-4 font-medium">
                Nazwa
              </th>
              <th class="py-3 pr-4 font-medium">
                Aktywna
              </th>
              <th class="py-3 pr-4 font-medium">
                Poprzedni stan
              </th>
              <th class="py-3 pr-4 font-medium">
                Aktualny stan / Kwota
              </th>
              <th class="py-3 pr-4 font-medium">
                Zużycie
              </th>
              <th class="py-3 pr-4 font-medium">
                Notatka
              </th>
              <th class="py-3 pr-4 text-right font-medium">
                Kwota
              </th>
            </tr>
          </thead>
          <tbody class="divide-y divide-white/10">
            <tr
              v-for="payment in data?.payments"
              :key="payment.id"
            >
              <td class="py-3 pr-4 font-medium text-stone-100">
                {{ payment.name }}
              </td>
              <td class="py-3 pr-4">
                <span
                  v-if="payment.type?.isRequired"
                  class="text-sm text-stone-400"
                >
                  <UBadge
                    color="success"
                    variant="subtle"
                  >
                    obowiązkowa
                  </UBadge>
                </span>
                <UCheckbox
                  v-else
                  :model-value="payment.isRequired"
                  @update:model-value="toggleRequired(payment.id, Boolean($event))"
                />
              </td>
              <td class="py-3 pr-4 text-stone-300">
                <span v-if="payment.meter">
                  {{ payment.meter.previousValue }} {{ payment.meter.unit || '' }}
                </span>
              </td>
              <td class="py-3 pr-4">
                <UInput
                  v-if="payment.meter"
                  v-model.number="readings[String(payment.id)]"
                  type="number"
                  step="1"
                  class="w-32"
                />
                <UInput
                  v-else-if="payment.type?.kind === 'variable' || !payment.type"
                  v-model.number="variableAmounts[String(payment.id)]"
                  type="number"
                  step="0.01"
                  class="w-32"
                />
              </td>
              <td class="py-3 pr-4 text-stone-300">
                <span v-if="payment.meter">
                  {{ Math.max((readings[String(payment.id)] ?? payment.meter.currentValue) - payment.meter.previousValue, 0) }} {{ payment.meter.unit || '' }}
                </span>
              </td>
              <td class="py-3 pr-4">
                <UInput
                  v-model="notes[String(payment.id)]"
                  class="w-40"
                  placeholder="..."
                />
              </td>
              <td class="py-3 pr-4 text-right font-semibold text-stone-100">
                {{ formatExact(paymentAmount(payment)) }}
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr class="border-t border-white/20">
              <td
                colspan="6"
                class="py-2 pr-4 text-right text-sm text-stone-400"
              >
                Razem przed zaokrągleniem
              </td>
              <td class="py-2 pr-4 text-right text-sm font-medium text-stone-300">
                {{ formatExact(liveTotal) }}
              </td>
            </tr>
            <tr>
              <td
                colspan="6"
                class="py-4 pr-4 text-right font-semibold text-stone-100"
              >
                Razem
              </td>
              <td class="py-4 pr-4 text-right text-xl font-semibold text-teal-300">
                {{ formatMoney(liveTotal) }}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </UCard>
  </div>
</template>
