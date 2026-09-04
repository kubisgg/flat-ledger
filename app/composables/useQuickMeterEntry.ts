export interface QuickMeterPayment {
  id: number
  name: string
  amount: number
  isRequired: boolean
  type?: {
    isMetered?: boolean
  } | null
  meter?: {
    currentValue: number
    previousValue: number
    unitPrice: number
    unit?: string | null
  } | null
}

interface QuickMeterMonth {
  id: number
  name: string
}

interface QuickMeterResponse {
  month: QuickMeterMonth
  payments: QuickMeterPayment[]
}

export function useQuickMeterEntry() {
  const route = useRoute()
  const router = useRouter()
  const toast = useToast()
  const monthId = computed(() => String(route.params.id))
  const { data, refresh } = useFetch<QuickMeterResponse>(() => `/api/months/${monthId.value}`)
  const readings = reactive<Record<string, number>>({})
  const touched = reactive(new Set<number>())
  const isSaving = ref(false)

  const meters = computed(() => data.value?.payments.filter(payment => payment.type?.isMetered && payment.meter) || [])
  const completedCount = computed(() => touched.size)
  const hasInvalidReadings = computed(() => meters.value.some(isBelowPrevious))

  watchEffect(() => {
    for (const payment of meters.value) {
      const key = String(payment.id)
      if (readings[key] === undefined) {
        readings[key] = payment.meter?.currentValue ?? payment.meter?.previousValue ?? 0
      }
    }
  })

  function markTouched(paymentId: number) {
    touched.add(paymentId)
  }

  function isBelowPrevious(payment: QuickMeterPayment) {
    const value = readings[String(payment.id)]
    return typeof value !== 'number' || !Number.isFinite(value) || value < previousValue(payment)
  }

  function previousValue(payment: QuickMeterPayment) {
    return payment.meter?.previousValue ?? 0
  }

  function usage(payment: QuickMeterPayment) {
    const current = readings[String(payment.id)] ?? payment.meter?.currentValue ?? 0
    return Math.max(current - previousValue(payment), 0)
  }

  function amount(payment: QuickMeterPayment) {
    return Math.floor(usage(payment) * (payment.meter?.unitPrice || 0) * 100) / 100
  }

  async function saveReadings() {
    if (!data.value?.month || hasInvalidReadings.value || isSaving.value) return false

    const savedMonthId = data.value.month.id
    const touchedReadings = Object.fromEntries([...touched].map((paymentId) => {
      return [String(paymentId), readings[String(paymentId)]]
    }))

    isSaving.value = true
    try {
      await $fetch(`/api/months/${savedMonthId}/readings`, {
        method: 'PUT',
        body: { currentReadings: touchedReadings }
      })
    } catch {
      toast.add({ title: 'Nie udało się zapisać stanów', color: 'error' })
      isSaving.value = false
      return false
    }

    toast.add({ title: 'Stany liczników zapisane', color: 'success' })

    try {
      await refresh()
    } catch {
      toast.add({ title: 'Zapisano, ale nie udało się odświeżyć danych', color: 'warning' })
    }

    try {
      await router.push(`/months/${savedMonthId}`)
    } catch {
      toast.add({ title: 'Zapisano. Wróć do miesiąca ręcznie', color: 'warning' })
    }

    isSaving.value = false
    return true
  }

  return {
    amount,
    completedCount,
    data,
    hasInvalidReadings,
    isBelowPrevious,
    isSaving,
    markTouched,
    meters,
    monthId,
    previousValue,
    readings,
    saveReadings,
    touched,
    usage
  }
}
