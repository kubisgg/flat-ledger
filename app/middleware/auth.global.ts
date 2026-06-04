export default defineNuxtRouteMiddleware(async (to) => {
  const publicRoutes = ['/login']
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  const session = await $fetch('/api/session', { headers }).catch(() => null)

  if (publicRoutes.includes(to.path)) {
    if (session) {
      return navigateTo('/')
    }
    return
  }

  if (!session) {
    return navigateTo('/login')
  }
})
