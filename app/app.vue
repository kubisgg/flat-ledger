<script setup lang="ts">
useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    { name: 'theme-color', content: '#21222c' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' }
  ],
  link: [
    { rel: 'icon', href: '/favicon.ico' },
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap' }
  ],
  htmlAttrs: {
    lang: 'pl'
  }
})

const title = 'Flat Ledger'
const description = 'Prywatny panel do zarządzania opłatami za mieszkanie.'
const colorMode = useColorMode()
const isMobileViewport = ref(false)

let mobileViewportQuery: MediaQueryList | undefined

function updateMobileViewport(event: MediaQueryList | MediaQueryListEvent) {
  isMobileViewport.value = event.matches
}

onMounted(() => {
  mobileViewportQuery = window.matchMedia('(max-width: 767px)')
  updateMobileViewport(mobileViewportQuery)
  mobileViewportQuery.addEventListener('change', updateMobileViewport)
})

onBeforeUnmount(() => {
  mobileViewportQuery?.removeEventListener('change', updateMobileViewport)
})

colorMode.preference = 'dark'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <UApp
    :toaster="{
      position: isMobileViewport ? 'top-center' : 'bottom-right',
      ui: {
        viewport: isMobileViewport ? 'mobile-toast-viewport' : undefined
      }
    }"
  >
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
