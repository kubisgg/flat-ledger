<script setup lang="ts">
const { formatMoney } = useMoney()
const selectedMonthId = ref('all')
const page = ref(1)
const { data: monthsData } = await useFetch('/api/months', {
  default: () => ({ data: [], total: 0 }),
  query: { page: 1, itemsPerPage: 100 }
})
const { data: paymentsData, refresh } = await useFetch('/api/payments', {
  default: () => ({ data: [], total: 0 }),
  query: { monthId: selectedMonthId, page }
})

watch(selectedMonthId, () => {
  page.value = 1
})

const deletePaymentId = ref<number | null>(null)

async function confirmRemovePayment() {
  if (deletePaymentId.value === null) return
  await $fetch(`/api/payments/${deletePaymentId.value}`, { method: 'DELETE' })
  deletePaymentId.value = null
  await refresh()
}
</script>

<template>
  <div>
    <div class="grid gap-6 pb-20 lg:grid-cols-[360px_1fr] md:pb-0 lg:items-start">
      <UCard class="bg-[#21222c] ring-1 ring-[#44475a]/60 shadow-lg shadow-black/40">
        <template #header>
          <h1 class="text-xl font-semibold">
            Dodaj opłatę jedronazową
          </h1>
        </template>
        <PaymentForm
          :months="monthsData.data"
          @saved="refresh"
        />
      </UCard>

      <UCard class="bg-[#21222c] ring-1 ring-[#44475a]/60 shadow-lg shadow-black/40">
        <template #header>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 class="text-xl font-semibold">
              Wszystkie opłaty
            </h2>
            <USelect
              v-model="selectedMonthId"
              :items="[{ label: 'Wszystkie miesiące', value: 'all' }, ...monthsData.data.map(month => ({ label: month.name, value: month.id }))]"
              class="w-full sm:w-64"
            />
          </div>
        </template>

        <div class="divide-y divide-[#44475a]/30">
          <div
            v-for="payment in paymentsData.data"
            :key="payment.id"
            class="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p class="font-medium">
                {{ payment.name }}
              </p>
              <p class="text-sm text-muted">
                <span class="flex items-center gap-1.5">
                  {{ payment.month?.name || 'brak miesiąca' }}
                  <span class="text-muted">·</span>
                  <UBadge
                    color="info"
                    variant="subtle"
                    size="sm"
                  >{{ payment.type?.name || 'Niestandardowa' }}</UBadge>
                </span>
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-semibold">{{ formatMoney(payment.amount) }}</span>
              <UButton
                icon="i-lucide-trash-2"
                color="error"
                variant="ghost"
                @click="deletePaymentId = payment.id"
              />
            </div>
          </div>
          <p
            v-if="!paymentsData.data.length"
            class="py-10 text-center text-muted"
          >
            Brak oplat.
          </p>
        </div>
        <div
          v-if="paymentsData.total > 10"
          class="mt-4 flex justify-center"
        >
          <UPagination
            v-model:page="page"
            :total="paymentsData.total"
            :items-per-page="10"
          />
        </div>
      </UCard>
    </div>

    <UModal
      :open="deletePaymentId !== null"
      title="Usuń opłatę"
      description="Tej operacji nie można cofnąć."
      :dismissible="false"
      :ui="{ footer: 'justify-end' }"
      @update:open="deletePaymentId = null"
    >
      <template #footer>
        <UButton
          label="Anuluj"
          color="neutral"
          variant="outline"
          @click="deletePaymentId = null"
        />
        <UButton
          label="Usuń"
          color="error"
          @click="confirmRemovePayment"
        />
      </template>
    </UModal>
  </div>
</template>
