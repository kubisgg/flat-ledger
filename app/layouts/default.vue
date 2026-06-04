<script setup lang="ts">
import { authClient } from '~~/lib/auth-client'

const route = useRoute()
const nav = [
  { label: 'Dashboard', to: '/', icon: 'i-lucide-layout-dashboard' },
  { label: 'Miesiące', to: '/months', icon: 'i-lucide-calendar-days' },
  { label: 'Opłaty', to: '/payments', icon: 'i-lucide-receipt' },
  { label: 'Ustawienia', to: '/settings', icon: 'i-lucide-settings' }
]

async function logout() {
  await authClient.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <div
    v-if="route.path === '/login'"
    class="min-h-screen bg-[#171614] text-[#f2eadc]"
  >
    <slot />
  </div>

  <div
    v-else
    class="min-h-screen bg-[#171614] text-[#f2eadc]"
  >
    <header class="sticky top-0 z-20 border-b border-white/10 bg-[#171614]/95 backdrop-blur">
      <UContainer class="flex h-16 items-center justify-between gap-4">
        <NuxtLink
          to="/"
          class="flex items-center gap-3 font-semibold"
        >
          <span class="grid size-9 place-items-center rounded-md bg-teal-500 text-stone-950 shadow-sm">
            <UIcon
              name="i-lucide-home"
              class="size-5"
            />
          </span>
          <span>Flat Ledger</span>
        </NuxtLink>

        <nav class="hidden items-center gap-1 md:flex">
          <UButton
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            :icon="item.icon"
            :variant="route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to)) ? 'solid' : 'ghost'"
            color="neutral"
            size="sm"
          >
            {{ item.label }}
          </UButton>
        </nav>

        <div class="flex items-center gap-1">
          <UButton
            icon="i-lucide-log-out"
            color="neutral"
            variant="ghost"
            aria-label="Wyloguj"
            @click="logout"
          />
        </div>
      </UContainer>
    </header>

    <main>
      <UContainer class="py-6 sm:py-8">
        <slot />
      </UContainer>
    </main>

    <nav class="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[#171614]/95 p-2 backdrop-blur md:hidden">
      <div class="grid grid-cols-4 gap-1">
        <UButton
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          :icon="item.icon"
          :variant="route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to)) ? 'soft' : 'ghost'"
          color="neutral"
          size="sm"
          block
        >
          {{ item.label }}
        </UButton>
      </div>
    </nav>
  </div>
</template>
