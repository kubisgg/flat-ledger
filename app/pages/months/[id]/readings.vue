<script setup lang="ts">
const { amount, data, hasInvalidReadings, isBelowPrevious, isSaving, markTouched, meters, monthId, previousValue, readings, saveReadings, touched, usage } = useQuickMeterEntry()
const { formatExact } = useMoney()
const currentIndex = ref(0)
const currentMeter = computed(() => meters.value[currentIndex.value])
const isLast = computed(() => currentIndex.value === meters.value.length - 1)

function focusReading() {
  nextTick(() => document.querySelector<HTMLInputElement>('#meter-step-input')?.focus())
}

function selectStep(index: number) {
  currentIndex.value = index
  focusReading()
}

function goNext() {
  const payment = currentMeter.value
  if (!payment) return
  markTouched(payment.id)
  if (!isLast.value) {
    currentIndex.value += 1
    focusReading()
  }
}

onMounted(focusReading)
</script>

<template>
  <div class="mx-auto flex min-h-[calc(100dvh-11rem)] max-w-md flex-col pb-16">
    <QuickMeterHeader
      :back-to="`/months/${monthId}`"
      eyebrow="Stany liczników"
      :month-name="data?.month.name"
    />

    <template v-if="currentMeter">
      <div class="mt-6 flex items-center gap-3">
        <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-white/8">
          <div
            class="meter-entry-progress h-full rounded-full transition-all duration-300"
            :style="{ width: `${(currentIndex + 1) / meters.length * 100}%` }"
          />
        </div>
        <span class="text-xs font-medium text-stone-400">{{ currentIndex + 1 }} z {{ meters.length }}</span>
      </div>

      <main class="flex flex-1 flex-col justify-center py-8">
        <div class="text-center">
          <span class="mx-auto grid size-14 place-items-center rounded-2xl bg-primary-400/12 text-primary-200 ring-1 ring-primary-400/20">
            <UIcon
              name="i-lucide-gauge"
              class="size-7"
            />
          </span>
          <p class="mt-5 text-sm text-stone-400">
            Teraz wpisujesz
          </p>
          <h2 class="mt-1 text-3xl font-semibold text-stone-50">
            {{ currentMeter.name }}
          </h2>
          <p class="mt-2 text-sm text-stone-400">
            Poprzedni stan <span class="font-medium text-stone-200">{{ previousValue(currentMeter) }} {{ currentMeter.meter?.unit || '' }}</span>
          </p>
        </div>

        <div class="mt-8">
          <label
            for="meter-step-input"
            class="sr-only"
          >Aktualny stan</label>
          <div class="relative">
            <UInput
              id="meter-step-input"
              v-model.number="readings[String(currentMeter.id)]"
              type="number"
              inputmode="decimal"
              step="any"
              :min="previousValue(currentMeter)"
              class="w-full [&_input]:h-24 [&_input]:px-5 [&_input]:pb-6 [&_input]:text-center [&_input]:text-4xl [&_input]:font-semibold [&_input]:tabular-nums"
              @update:model-value="markTouched(currentMeter.id)"
            />
            <span class="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs font-medium tracking-wide text-stone-500">
              {{ currentMeter.meter?.unit || 'aktualny stan' }}
            </span>
          </div>
          <p
            v-if="isBelowPrevious(currentMeter)"
            class="mt-2 text-center text-sm text-red-300"
          >
            Stan musi być równy lub większy niż {{ previousValue(currentMeter) }}.
          </p>

          <div class="mt-4 flex justify-center gap-6 text-sm">
            <p class="text-stone-400">
              Zużycie <span class="ml-1 font-medium text-stone-100">{{ usage(currentMeter) }} {{ currentMeter.meter?.unit || '' }}</span>
            </p>
            <p class="text-stone-400">
              Kwota <span class="ml-1 font-medium text-primary-200">{{ formatExact(amount(currentMeter)) }}</span>
            </p>
          </div>
        </div>
      </main>

      <footer class="space-y-4">
        <div class="flex justify-center gap-2">
          <button
            v-for="(payment, index) in meters"
            :key="payment.id"
            type="button"
            class="grid size-8 place-items-center rounded-full transition"
            :class="index === currentIndex ? 'meter-step-active' : touched.has(payment.id) ? 'bg-teal-400/15 text-teal-200' : 'bg-white/6 text-stone-500'"
            :aria-label="`Przejdź do licznika ${payment.name}`"
            @click="selectStep(index)"
          >
            <UIcon
              v-if="touched.has(payment.id) && index !== currentIndex"
              name="i-lucide-check"
              class="size-4"
            />
            <span
              v-else
              class="text-xs font-semibold"
            >{{ index + 1 }}</span>
          </button>
        </div>

        <div class="grid grid-cols-[auto_1fr] gap-2">
          <UButton
            icon="i-lucide-arrow-left"
            color="neutral"
            variant="soft"
            size="xl"
            square
            :disabled="currentIndex === 0"
            aria-label="Poprzedni licznik"
            @click="selectStep(currentIndex - 1)"
          />
          <UButton
            v-if="!isLast"
            trailing-icon="i-lucide-arrow-right"
            size="xl"
            block
            :disabled="isBelowPrevious(currentMeter)"
            @click="goNext"
          >
            Dalej
          </UButton>
          <UButton
            v-else
            icon="i-lucide-save"
            size="xl"
            block
            :loading="isSaving"
            :disabled="hasInvalidReadings"
            @click="saveReadings"
          >
            Zapisz wszystkie
          </UButton>
        </div>
      </footer>
    </template>

    <div
      v-else
      class="my-auto rounded-2xl border border-dashed border-white/15 px-5 py-10 text-center"
    >
      <UIcon
        name="i-lucide-gauge"
        class="mx-auto size-8 text-stone-500"
      />
      <p class="mt-3 font-medium text-stone-200">
        Brak liczników w tym miesiącu
      </p>
    </div>
  </div>
</template>

<style scoped>
.meter-entry-progress,
.meter-step-active {
  background-color: var(--ui-primary);
}

.meter-step-active {
  color: var(--ui-text-inverted);
}
</style>
