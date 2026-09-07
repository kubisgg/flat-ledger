<script setup lang="ts">
const props = withDefaults(defineProps<{
  text: string | (() => string | Promise<string>)
  label: string
  copiedLabel: string
  errorLabel?: string
  disabled?: boolean
  resetKey?: number
}>(), {
  errorLabel: 'Nie udało się skopiować. Zaznacz tekst i skopiuj go ręcznie.',
  disabled: false,
  resetKey: 0
})

const emit = defineEmits<{
  'update:copying': [value: boolean]
  'error': [text: string | undefined]
}>()
const toast = useToast()
const copied = ref(false)
const copying = ref(false)
let resetTimer: ReturnType<typeof setTimeout> | undefined
let disposed = false

function resetFeedback() {
  clearTimeout(resetTimer)
  resetTimer = undefined
  copied.value = false
}

watch(() => [props.text, props.resetKey], resetFeedback)
onBeforeUnmount(() => {
  disposed = true
  resetFeedback()
})

async function writeClipboard(text: string) {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return
    } catch (error) {
      if (!import.meta.dev) throw error
    }
  }

  if (!import.meta.dev) throw new Error('Clipboard API unavailable')

  const field = document.createElement('textarea')
  field.value = text
  field.readOnly = true
  field.style.position = 'fixed'
  field.style.opacity = '0'
  const focused = document.activeElement
  document.body.appendChild(field)
  try {
    field.select()
    field.setSelectionRange(0, text.length)
    if (!document.execCommand('copy')) throw new Error('Clipboard unavailable')
  } finally {
    field.remove()
    if (focused instanceof HTMLElement) focused.focus()
  }
}

async function copy() {
  if (props.disabled || copying.value || copied.value) return
  copying.value = true
  emit('update:copying', true)
  let text: string | undefined
  try {
    text = typeof props.text === 'function' ? await props.text() : props.text
    if (disposed || !text) return
    await writeClipboard(text)
    if (disposed) return
    copied.value = true
    resetTimer = setTimeout(resetFeedback, 3000)
    toast.add({ title: props.copiedLabel, color: 'success' })
  } catch {
    if (disposed) return
    toast.add({ title: props.errorLabel, color: 'error' })
    emit('error', text)
  } finally {
    copying.value = false
    emit('update:copying', false)
  }
}
</script>

<template>
  <UButton
    type="button"
    :color="copied ? 'success' : 'neutral'"
    :variant="copied ? 'subtle' : 'outline'"
    square
    class="size-8 shrink-0 items-center justify-center p-0 duration-200 disabled:opacity-100"
    :aria-label="copied ? copiedLabel : label"
    :title="copied ? copiedLabel : label"
    :aria-busy="copying"
    :disabled="disabled || copying || copied || text === ''"
    @click="copy"
  >
    <span
      class="relative size-4"
      aria-hidden="true"
    >
      <UIcon
        name="i-lucide-copy"
        class="absolute inset-0 size-4 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
        :class="copied ? 'scale-75 opacity-0' : 'scale-100 opacity-100'"
      />
      <UIcon
        name="i-lucide-check"
        class="absolute inset-0 size-4 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
        :class="copied ? 'scale-100 opacity-100' : 'scale-75 opacity-0'"
      />
    </span>
  </UButton>
</template>
