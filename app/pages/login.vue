<script setup lang="ts">
import { authClient } from '~~/lib/auth-client'

const email = ref('')
const password = ref('')
const rememberMe = ref(true)
const loading = ref(false)
const error = ref('')

async function submit() {
  loading.value = true
  error.value = ''

  await authClient.signIn.email({
    email: email.value,
    password: password.value,
    rememberMe: rememberMe.value,
    callbackURL: '/'
  }, {
    onSuccess: async () => {
      await navigateTo('/')
    },
    onError: (ctx) => {
      error.value = ctx.error.message || 'Nie udało się zalogować'
    }
  })

  loading.value = false
}
</script>

<template>
  <main class="grid min-h-screen place-items-center px-4">
    <UCard class="w-full max-w-sm rounded-xl bg-[#21222c] ring-1 ring-[#44475a]/60 shadow-2xl shadow-black/60">
      <template #header>
        <div class="space-y-1">
          <div class="flex items-center gap-2 mb-3">
            <span class="grid size-8 place-items-center rounded-lg bg-linear-to-br from-primary-400 to-primary-700 text-white shadow-lg shadow-purple-950/60 ring-1 ring-primary-400/25">
              <UIcon
                name="i-lucide-home"
                class="size-4"
              />
            </span>
            <span
              class="text-sm font-medium"
              style="font-family: 'Outfit', sans-serif; color: #6272a4"
            >Flat Ledger</span>
          </div>
          <h1 class="text-2xl font-semibold">
            Logowanie
          </h1>
        </div>
      </template>

      <form
        class="space-y-4"
        @submit.prevent="submit"
      >
        <UAlert
          v-if="error"
          color="error"
          variant="soft"
          icon="i-lucide-circle-alert"
          :title="error"
        />
        <UFormField label="Email">
          <UInput
            v-model="email"
            type="email"
            autocomplete="email"
            required
            class="w-full"
          />
        </UFormField>
        <UFormField label="Hasło">
          <UInput
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            class="w-full"
          />
        </UFormField>
        <UCheckbox
          v-model="rememberMe"
          label="Zapamiętaj mnie"
        />
        <UButton
          type="submit"
          block
          icon="i-lucide-log-in"
          :loading="loading"
        >
          Zaloguj
        </UButton>
      </form>
    </UCard>
  </main>
</template>
