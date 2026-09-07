import type { H3Event } from 'h3'
import { createError } from 'h3'
import { requireAdmin } from './guards'

export function appUrl() {
  return new URL(process.env.AUTH_URL || 'http://localhost:3000')
}

export function isMcpOriginAllowed(origin: string | undefined) {
  return !origin || origin === appUrl().origin
}

export function validateMcpOrigin(event: H3Event) {
  if (!isMcpOriginAllowed(event.node.req.headers.origin)) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid origin' })
  }
}

export async function requireMcpSettingsAdmin(event: H3Event) {
  event.node.res.setHeader('Cache-Control', 'no-store')
  validateMcpOrigin(event)
  await requireAdmin(event)
}
