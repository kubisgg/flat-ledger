// https://nuxt.com/docs/api/configuration/nuxt-config
const allowedHosts = process.env.DEV_SERVER_ALLOWED_HOSTS
  ?.split(',')
  .map(host => host.trim())
  .filter(Boolean) || []

export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  devtools: {
    enabled: true
  },

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-01-15',

  vite: {
    server: {
      allowedHosts
    }
  },

  eslint: {
    config: {
      stylistic: {
        commaDangle: 'never',
        braceStyle: '1tbs'
      }
    }
  },

  icon: {
    clientBundle: {
      scan: true
    },
    serverBundle: {
      collections: ['lucide']
    }
  }
})
