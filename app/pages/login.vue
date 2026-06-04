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
    <UCard class="w-full max-w-sm rounded-lg bg-white/5 ring-white/10">
      <template #header>
        <div class="space-y-1">
          <p class="text-sm text-muted">
            Flat Ledger
          </p>
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
