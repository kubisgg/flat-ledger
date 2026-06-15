<script setup lang="ts">
const { formatMoney } = useMoney()
const { data } = await useFetch('/api/dashboard')
const { data: meterHistory } = await useFetch('/api/dashboard/meter-history')
const { data: session } = await useFetch('/api/session')

const statusLabel = computed(() => ({
  paid: 'opłacony',
  unpaid: 'do zapłaty'
}[data.value?.status || 'unpaid']))

const chartOptions = computed(() => ({
  chart: {
    type: 'line',
    background: 'transparent',
    toolbar: { show: false },
    animations: { enabled: true }
  },
  theme: { mode: 'dark' },
  colors: ['#ff79c6', '#ffb86c', '#8be9fd', '#bd93f9', '#50fa7b', '#f1fa8c'],
  stroke: { curve: 'smooth', width: 2 },
  grid: { borderColor: 'rgba(68,71,90,0.6)' },
  xaxis: {
    categories: allLabels.value,
    labels: { style: { colors: '#6272a4' } }
  },
  yaxis: yaxisConfig.value,
  legend: { labels: { colors: '#f8f8f2' } },
  tooltip: { theme: 'dark' }
}))

const units = computed(() => {
  if (!meterHistory.value?.length) return []
  return [...new Set(meterHistory.value.map(t => t.unit || ''))]
})

const seriesName = (type: { name: string, unit?: string | null }) =>
  `${type.name}${type.unit ? ` (${type.unit})` : ''}`

const unitSeriesNames = computed(() => {
  const map: Record<string, string[]> = {}
  for (const type of meterHistory.value || []) {
    const u = type.unit || '';
    (map[u] ||= []).push(seriesName(type))
  }
  return map
})

// one yaxis per unit so different scales stay readable
const yaxisConfig = computed(() =>
  units.value.map((unit, i) => ({
    seriesName: unitSeriesNames.value[unit],
    opposite: i > 0,
    title: { text: unit || undefined, style: { color: '#6272a4' } },
    labels: { style: { colors: '#6272a4' } }
  }))
)

const allLabels = computed(() => {
  if (!meterHistory.value?.length) return []
  const longest = meterHistory.value.reduce((a, b) => a.history.length > b.history.length ? a : b)
  return longest.history.map(h => h.label)
})

const chartSeries = computed(() => {
  if (!meterHistory.value?.length) return []
  return meterHistory.value.map(type => ({
    name: seriesName(type),
    data: type.history.map(h => h.usage)
  }))
})
</script>

<template>
  <div class="space-y-6 pb-20 md:pb-0">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="mt-1 mb-8 text-5xl font-bold">
          Cześć, {{ session?.user?.name || 'użytkowniku' }}!
        </h1>
        <p
          class="text-xs font-medium uppercase tracking-widest"
          style="color: #6272a4"
        >
          Obecny miesiąc
        </p>
        <h1 class="mt-1 text-3xl font-semibold">
          {{ data?.month?.name || 'Brak miesięcy' }}
        </h1>
      </div>
      <UButton
        to="/months"
        icon="i-lucide-plus"
      >
        Dodaj miesiąc
      </UButton>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <UCard class="bg-[#21222c] ring-1 ring-[#44475a]/60 shadow-lg shadow-black/40">
        <p
          class="text-xs font-medium uppercase tracking-widest"
          style="color: #6272a4"
        >
          Suma
        </p>
        <p
          class="mt-2 text-2xl font-semibold"
          style="color: #f8f8f2"
        >
          {{ formatMoney(data?.total) }}
        </p>
      </UCard>
      <UCard class="bg-[#21222c] ring-1 ring-[#44475a]/60 shadow-lg shadow-black/40">
        <p
          class="text-xs font-medium uppercase tracking-widest"
          style="color: #6272a4"
        >
          Status
        </p>
        <UBadge
          class="mt-3"
          :color="data?.status === 'paid' ? 'success' : 'warning'"
          variant="subtle"
          size="lg"
        >
          {{ statusLabel }}
        </UBadge>
      </UCard>
    </div>

    <template v-if="meterHistory?.length">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <UCard
          v-for="type in meterHistory"
          :key="type.id"
          class="bg-[#21222c] ring-1 ring-[#44475a]/60 shadow-md shadow-black/30"
        >
          <div class="flex items-start justify-between">
            <div>
              <p
                class="text-xs font-medium uppercase tracking-widest"
                style="color: #6272a4"
              >
                {{ type.name }}
              </p>
              <p class="mt-1 text-2xl font-semibold">
                {{ type.currentUsage }} <span
                  class="text-base"
                  style="color: #6272a4"
                >{{ type.unit }}</span>
              </p>
            </div>
            <UBadge
              v-if="type.change"
              :color="type.change.sign > 0 ? 'error' : type.change.sign < 0 ? 'success' : 'neutral'"
              variant="subtle"
              class="mt-1"
            >
              {{ type.change.text }}
            </UBadge>
          </div>
          <p
            v-if="type.previousUsage !== null"
            class="mt-1 text-xs"
            style="color: #6272a4"
          >
            poprzednio: {{ type.previousUsage }} {{ type.unit }}
          </p>
        </UCard>
      </div>

      <UCard class="bg-[#21222c] ring-1 ring-[#44475a]/60 shadow-xl shadow-black/40">
        <template #header>
          <h2 class="text-lg font-semibold">
            Zużycie - ostatnie 12 miesięcy
          </h2>
        </template>
        <ClientOnly>
          <apexchart
            type="line"
            height="280"
            :options="chartOptions"
            :series="chartSeries"
          />
          <template #fallback>
            <div class="skeleton-shimmer h-73.75 w-full rounded-lg" />
          </template>
        </ClientOnly>
      </UCard>
    </template>

    <UCard
      v-if="data?.month"
      class="bg-[#21222c] ring-1 ring-[#44475a]/60 shadow-lg shadow-black/30"
    >
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold">
            Opłaty w miesiącu
          </h2>
          <UButton
            :to="`/months/${data.month.id}`"
            icon="i-lucide-arrow-right"
            color="neutral"
            variant="ghost"
          />
        </div>
      </template>
      <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="payment in data.payments"
          :key="payment.id"
          class="flex items-center justify-between rounded-lg border border-[#44475a]/50 bg-[#282a36] px-3 py-2 transition-colors hover:border-primary-400/30 hover:bg-[#282a36]"
        >
          <span
            class="text-sm font-medium"
            style="color: #f8f8f2"
          >{{ payment.name }}</span>
          <span
            class="text-sm font-semibold"
            style="color: #f8f8f2"
          >{{ formatMoney(payment.amount) }}</span>
        </div>
      </div>
    </UCard>
  </div>
</template>
