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

function isActive(item: { to: string }) {
  return route.path === item.to || (item.to !== '/' && route.path.startsWith(item.to))
}
</script>

<template>
  <div
    v-if="route.path === '/login'"
    class="min-h-screen text-[#f8f8f2]"
  >
    <slot />
  </div>

  <div
    v-else
    class="min-h-screen text-[#f8f8f2]"
  >
    <header class="sticky top-0 z-20 border-b border-[#44475a]/60 bg-[#21222c]/95 backdrop-blur-md">
      <UContainer class="flex h-16 items-center justify-between gap-4">
        <NuxtLink
          to="/"
          class="flex items-center gap-3"
        >
          <span class="grid size-9 place-items-center rounded-lg bg-linear-to-br from-primary-400 to-primary-700 text-white shadow-lg shadow-purple-950/60 ring-1 ring-primary-400/25">
            <UIcon
              name="i-lucide-home"
              class="size-5"
            />
          </span>
          <span class="font-semibold tracking-tight" style="font-family: 'Outfit', sans-serif; color: #f8f8f2">Flat Ledger</span>
        </NuxtLink>

        <nav class="hidden items-center gap-1 md:flex">
          <UButton
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            :icon="item.icon"
            :color="isActive(item) ? 'primary' : 'neutral'"
            :variant="isActive(item) ? 'subtle' : 'ghost'"
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

    <nav class="fixed inset-x-0 bottom-0 z-20 border-t border-[#44475a]/60 bg-[#21222c]/95 p-2 backdrop-blur-md md:hidden">
      <div class="grid grid-cols-4 gap-1">
        <UButton
          v-for="item in nav"
          :key="item.to"
          :to="item.to"
          :icon="item.icon"
          :color="isActive(item) ? 'primary' : 'neutral'"
          :variant="isActive(item) ? 'soft' : 'ghost'"
          size="sm"
          block
        >
          {{ item.label }}
        </UButton>
      </div>
    </nav>
  </div>
</template>
