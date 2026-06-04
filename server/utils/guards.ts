import { getHeaders } from 'h3'
import { auth } from './auth'

export async function requireAdmin(event: Parameters<typeof getHeaders>[0]) {
  const session = await auth.api.getSession({
    headers: new Headers(getHeaders(event) as HeadersInit)
  })

  if (!session) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized'
    })
  }

  return session
}
