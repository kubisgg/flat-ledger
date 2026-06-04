<script setup lang="ts">
import { authClient } from '~~/lib/auth-client'

const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined
const { data: session, refresh } = await useFetch('/api/session', { headers })

const newName = ref('')
const nameLoading = ref(false)
const nameError = ref('')
const nameSuccess = ref(false)

const newEmail = ref('')
const emailLoading = ref(false)
const emailError = ref('')
const emailSuccess = ref(false)

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const passwordLoading = ref(false)
const passwordError = ref('')
const passwordSuccess = ref(false)

async function changeName() {
  nameLoading.value = true
  nameError.value = ''
  nameSuccess.value = false
  const { error } = await authClient.updateUser({ name: newName.value })
  if (error) {
    nameError.value = error.message || 'Błąd zmiany nazwy'
  } else {
    nameSuccess.value = true
    newName.value = ''
    await refresh()
  }
  nameLoading.value = false
}

async function changeEmail() {
  emailLoading.value = true
  emailError.value = ''
  emailSuccess.value = false
  const { error } = await authClient.changeEmail({ newEmail: newEmail.value, callbackURL: '/account' })
  if (error) {
    emailError.value = error.message || 'Błąd zmiany email\'a'
  } else {
    emailSuccess.value = true
    newEmail.value = ''
    await refresh()
  }
  emailLoading.value = false
}

async function changePassword() {
  passwordLoading.value = true
  passwordError.value = ''
  passwordSuccess.value = false
  if (newPassword.value !== confirmPassword.value) {
    passwordError.value = 'Hasła muszą być identyczne'
    passwordLoading.value = false
    return
  }
  const { error } = await authClient.changePassword({
    currentPassword: currentPassword.value,
    newPassword: newPassword.value,
    revokeOtherSessions: false
  })
  if (error) {
    passwordError.value = error.message || 'Błąd zmiany hasła'
  } else {
    passwordSuccess.value = true
    currentPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  }
  passwordLoading.value = false
}
</script>

<template>
  <div class="mx-auto max-w-lg space-y-6">
    <h1 class="text-2xl font-semibold">
      Ustawienia konta
    </h1>

    <UCard class="rounded-xl bg-[#21222c] ring-1 ring-[#44475a]/60">
      <div class="space-y-1 text-sm">
        <div class="text-[#6272a4]">
          Nazwa: <span class="text-[#f8f8f2]">{{ session?.user?.name }}</span>
        </div>
        <div class="text-[#6272a4]">
          Email: <span class="text-[#f8f8f2]">{{ session?.user?.email }}</span>
        </div>
      </div>
    </UCard>

    <UCard class="rounded-xl bg-[#21222c] ring-1 ring-[#44475a]/60">
      <template #header>
        <h2 class="text-base font-medium">
          Zmień nazwę użytkownika
        </h2>
      </template>
      <form
        class="space-y-4"
        @submit.prevent="changeName"
      >
        <UAlert
          v-if="nameError"
          color="error"
          variant="soft"
          icon="i-lucide-circle-alert"
          :title="nameError"
        />
        <UAlert
          v-if="nameSuccess"
          color="success"
          variant="soft"
          icon="i-lucide-check-circle"
          title="Nazwa zmieniona"
        />
        <UFormField label="Nowa nazwa">
          <UInput
            v-model="newName"
            required
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          :loading="nameLoading"
          icon="i-lucide-save"
        >
          Zapisz
        </UButton>
      </form>
    </UCard>

    <UCard class="rounded-xl bg-[#21222c] ring-1 ring-[#44475a]/60">
      <template #header>
        <h2 class="text-base font-medium">
          Zmień email
        </h2>
      </template>
      <form
        class="space-y-4"
        @submit.prevent="changeEmail"
      >
        <UAlert
          v-if="emailError"
          color="error"
          variant="soft"
          icon="i-lucide-circle-alert"
          :title="emailError"
        />
        <UAlert
          v-if="emailSuccess"
          color="success"
          variant="soft"
          icon="i-lucide-check-circle"
          title="Email zmieniony"
        />
        <UFormField label="Nowy email">
          <UInput
            v-model="newEmail"
            type="email"
            autocomplete="email"
            required
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          :loading="emailLoading"
          icon="i-lucide-save"
        >
          Zapisz
        </UButton>
      </form>
    </UCard>

    <UCard class="rounded-xl bg-[#21222c] ring-1 ring-[#44475a]/60">
      <template #header>
        <h2 class="text-base font-medium">
          Zmień hasło
        </h2>
      </template>
      <form
        class="space-y-4"
        @submit.prevent="changePassword"
      >
        <UAlert
          v-if="passwordError"
          color="error"
          variant="soft"
          icon="i-lucide-circle-alert"
          :title="passwordError"
        />
        <UAlert
          v-if="passwordSuccess"
          color="success"
          variant="soft"
          icon="i-lucide-check-circle"
          title="Hasło zmienione"
        />
        <UFormField label="Obecne hasło">
          <UInput
            v-model="currentPassword"
            type="password"
            autocomplete="current-password"
            required
            class="w-full"
          />
        </UFormField>
        <UFormField label="Nowe hasło">
          <UInput
            v-model="newPassword"
            type="password"
            autocomplete="new-password"
            required
            class="w-full"
          />
        </UFormField>
        <UFormField label="Potwierdź hasło">
          <UInput
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            required
            class="w-full"
          />
        </UFormField>
        <UButton
          type="submit"
          :loading="passwordLoading"
          icon="i-lucide-key"
        >
          Zmień hasło
        </UButton>
      </form>
    </UCard>
  </div>
</template>
