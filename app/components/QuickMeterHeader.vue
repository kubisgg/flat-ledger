<script setup lang="ts">
defineProps<{
  backTo: string
  eyebrow: string
  monthName?: string
}>()
</script>

<template>
  <header class="flex items-start gap-3">
    <UButton
      :to="backTo"
      icon="i-lucide-arrow-left"
      color="neutral"
      variant="soft"
      square
      aria-label="Wróć"
      class="mt-0.5 shrink-0"
    />
    <div class="min-w-0">
      <p class="text-xs font-semibold tracking-[0.16em] text-primary-300 uppercase">
        {{ eyebrow }}
      </p>
      <h1 class="truncate text-2xl font-semibold text-stone-50">
        {{ monthName || 'Stany liczników' }}
      </h1>
    </div>
  </header>
</template>
