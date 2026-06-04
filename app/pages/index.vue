<script setup lang="ts">
const { formatMoney } = useMoney()
const { data } = await useFetch('/api/dashboard')
const { data: meterHistory } = await useFetch('/api/dashboard/meter-history')

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
  colors: ['#f472b6', '#fb923c', '#60a5fa', '#2dd4bf', '#a78bfa', '#34d399'],
  stroke: { curve: 'smooth', width: 2 },
  grid: { borderColor: 'rgba(255,255,255,0.08)' },
  xaxis: {
    categories: allLabels.value,
    labels: { style: { colors: '#a8a29e' } }
  },
  yaxis: { labels: { style: { colors: '#a8a29e' } } },
  legend: { labels: { colors: '#e7e5e4' } },
  tooltip: { theme: 'dark' }
}))

const allLabels = computed(() => {
  if (!meterHistory.value?.length) return []
  const longest = meterHistory.value.reduce((a, b) => a.history.length > b.history.length ? a : b)
  return longest.history.map(h => h.label)
})

const chartSeries = computed(() => {
  if (!meterHistory.value?.length) return []
  return meterHistory.value.map(type => ({
    name: `${type.name}${type.unit ? ` (${type.unit})` : ''}`,
    data: type.history.map(h => h.usage)
  }))
})
</script>

<template>
  <div class="space-y-6 pb-20 md:pb-0">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-sm text-muted">
          Obecny miesiąc
        </p>
        <h1 class="text-3xl font-semibold">
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
      <UCard class="bg-white/5 ring-white/10">
        <p class="text-sm text-muted">
          Suma
        </p>
        <p class="mt-2 text-2xl font-semibold">
          {{ formatMoney(data?.total) }}
        </p>
      </UCard>
      <UCard class="bg-white/5 ring-white/10">
        <p class="text-sm text-muted">
          Status
        </p>
        <UBadge
          class="mt-3"
          :color="data?.status === 'paid' ? 'success' : 'warning'"
          variant="subtle"
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
          class="bg-white/5 ring-white/10"
        >
          <div class="flex items-start justify-between">
            <div>
              <p class="text-sm text-muted">
                {{ type.name }}
              </p>
              <p class="mt-1 text-2xl font-semibold">
                {{ type.currentUsage }} <span class="text-base text-muted">{{ type.unit }}</span>
              </p>
            </div>
            <UBadge
              v-if="type.changePercent !== null"
              :color="type.changePercent > 0 ? 'error' : type.changePercent < 0 ? 'success' : 'neutral'"
              variant="subtle"
              class="mt-1"
            >
              {{ type.changePercent > 0 ? '+' : '' }}{{ type.changePercent }}%
            </UBadge>
          </div>
          <p
            v-if="type.previousUsage !== null"
            class="mt-1 text-xs text-muted"
          >
            poprzednio: {{ type.previousUsage }} {{ type.unit }}
          </p>
        </UCard>
      </div>

      <UCard class="bg-white/5 ring-white/10">
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
        </ClientOnly>
      </UCard>
    </template>

    <UCard
      v-if="data?.month"
      class="bg-white/5 ring-white/10"
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
          class="flex items-center justify-between rounded-lg border border-white/10 bg-stone-950/40 px-3 py-2"
        >
          <span class="text-sm font-medium">{{ payment.name }}</span>
          <span class="text-sm font-semibold">{{ formatMoney(payment.amount) }}</span>
        </div>
      </div>
    </UCard>
  </div>
</template>
