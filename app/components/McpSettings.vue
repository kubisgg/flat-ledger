<script setup lang="ts">
const toast = useToast()
const { data: settings, status, error, refresh } = await useFetch('/api/settings/mcp')
const busy = ref(false)
const token = ref('')
const tokenVisible = ref(false)
const confirmReset = ref(false)
const actionError = ref('')
const tokenCopyVersion = ref(0)

async function toggle(enabled: boolean) {
  busy.value = true
  actionError.value = ''
  try {
    settings.value = await $fetch('/api/settings/mcp', { method: 'PUT', body: { enabled } })
    token.value = ''
    tokenVisible.value = false
    tokenCopyVersion.value++
    toast.add({ title: enabled ? 'Włączono serwer MCP' : 'Wyłączono serwer MCP', color: 'success' })
  } catch {
    actionError.value = 'Nie udało się zmienić ustawień MCP. Spróbuj ponownie.'
  } finally {
    busy.value = false
  }
}

async function revealToken() {
  if (tokenVisible.value) {
    tokenVisible.value = false
    token.value = ''
    return
  }
  busy.value = true
  actionError.value = ''
  try {
    token.value = (await $fetch('/api/settings/mcp/token')).token
    tokenVisible.value = true
  } catch {
    actionError.value = 'Nie udało się odczytać tokena. Spróbuj ponownie lub wygeneruj nowy.'
  } finally {
    busy.value = false
  }
}

async function resetToken() {
  busy.value = true
  actionError.value = ''
  try {
    token.value = (await $fetch('/api/settings/mcp/token', { method: 'POST' })).token
    tokenCopyVersion.value++
    tokenVisible.value = false
    confirmReset.value = false
    await refresh()
    toast.add({ title: 'Wygenerowano nowy token', color: 'success' })
  } catch {
    actionError.value = 'Nie udało się wygenerować tokena. Spróbuj ponownie.'
  } finally {
    busy.value = false
  }
}

async function tokenToCopy() {
  actionError.value = ''
  token.value = (await $fetch('/api/settings/mcp/token')).token
  return token.value
}

function handleTokenCopyError(value: string | undefined) {
  if (value) {
    token.value = value
    tokenVisible.value = true
    actionError.value = 'Przeglądarka zablokowała kopiowanie. Zaznacz tekst w polu i skopiuj go ręcznie.'
  } else {
    actionError.value = 'Nie udało się pobrać tokena. Spróbuj ponownie.'
  }
}
</script>

<template>
  <UCard class="bg-[#21222c] ring-1 ring-[#44475a]/60 shadow-lg shadow-black/40">
    <template #header>
      <div class="flex items-center justify-between gap-4">
        <div class="space-y-1">
          <h2 class="text-xl font-semibold text-stone-50">
            Serwer MCP
          </h2>
        </div>
        <UBadge
          :color="settings?.enabled ? 'success' : 'neutral'"
          variant="subtle"
          class="shrink-0"
        >
          {{ settings?.enabled ? 'Włączony' : 'Wyłączony' }}
        </UBadge>
      </div>
    </template>

    <div class="space-y-5">
      <div v-if="status === 'pending'">
        Ładowanie ustawień…
      </div>
      <UAlert
        v-else-if="error"
        color="error"
        title="Nie udało się wczytać ustawień MCP"
        :actions="[{ label: 'Spróbuj ponownie', onClick: () => refresh() }]"
      />
      <template v-else-if="settings">
        <USwitch
          :model-value="settings.enabled"
          :disabled="busy || (!settings.configured && !settings.enabled)"
          label="Dostęp przez MCP"
          aria-label="Włącz dostęp przez MCP"
          @update:model-value="toggle"
        />

        <UAlert
          v-if="!settings.configured"
          color="warning"
          title="Skonfiguruj AUTH_SECRET"
          description="Aby włączyć MCP, ustaw na serwerze losowy AUTH_SECRET o długości co najmniej 32 znaków i uruchom aplikację ponownie."
        />
        <UAlert
          v-else-if="settings.hasToken && !settings.tokenReadable"
          color="warning"
          title="Wygeneruj nowy token"
          description="Nie można odczytać zapisanego tokena."
        />

        <div class="grid gap-4">
          <UFormField
            v-for="(endpoint, index) in settings.endpoints"
            :key="endpoint"
            :label="settings.endpoints.length > 1 ? `Adres serwera ${index + 1}` : 'Adres serwera'"
          >
            <div class="flex gap-2">
              <UInput
                :model-value="endpoint"
                readonly
                class="min-w-0 flex-1"
                :aria-label="`Adres serwera MCP ${index + 1}`"
              />
              <CopyButton
                :text="endpoint"
                :label="`Kopiuj adres serwera MCP ${index + 1}`"
                copied-label="Skopiowano adres serwera MCP"
                :disabled="busy"
                @update:copying="busy = $event"
              />
            </div>
          </UFormField>

          <UFormField
            v-if="settings.hasToken"
            label="Token"
          >
            <div class="flex gap-2">
              <UInput
                :model-value="tokenVisible ? token : '••••••••••••••••••••••••'"
                readonly
                autocomplete="off"
                class="min-w-0 flex-1"
                aria-label="Token MCP"
              />
              <UButton
                :icon="tokenVisible ? 'i-lucide-eye-off' : 'i-lucide-eye'"
                :color="tokenVisible ? 'primary' : 'neutral'"
                :variant="tokenVisible ? 'subtle' : 'outline'"
                class="size-8 shrink-0 justify-center p-0 duration-200"
                :aria-pressed="tokenVisible"
                :aria-label="tokenVisible ? 'Ukryj token' : 'Pokaż token'"
                :disabled="busy || !settings.tokenReadable"
                @click="revealToken"
              />
              <CopyButton
                :text="tokenToCopy"
                label="Kopiuj token"
                copied-label="Skopiowano token"
                :reset-key="tokenCopyVersion"
                :disabled="busy || !settings.tokenReadable"
                @update:copying="busy = $event"
                @error="handleTokenCopyError"
              />
            </div>
          </UFormField>
          <p
            v-else
            class="text-sm text-stone-400"
          >
            Pierwsze włączenie serwera MCP automatycznie wygeneruje token dostępu.
          </p>
        </div>

        <div
          v-if="settings.hasToken && settings.configured"
          class="border-t border-[#44475a]/60 pt-4"
        >
          <div
            v-if="confirmReset"
            class="space-y-3"
          >
            <p class="text-sm text-stone-200">
              Poprzedni token przestanie działać. Po resecie wklej nowy token w każdym podłączonym kliencie.
            </p>
            <div class="flex flex-wrap gap-2">
              <UButton
                color="warning"
                :loading="busy"
                @click="resetToken"
              >
                Wygeneruj nowy token
              </UButton>
              <UButton
                color="neutral"
                variant="outline"
                :disabled="busy"
                @click="confirmReset = false"
              >
                Anuluj
              </UButton>
            </div>
          </div>
          <UButton
            v-else
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="outline"
            :disabled="busy"
            @click="confirmReset = true"
          >
            Resetuj token
          </UButton>
        </div>
      </template>

      <UAlert
        v-if="actionError"
        color="error"
        :title="actionError"
        role="alert"
      />
    </div>
  </UCard>
</template>
