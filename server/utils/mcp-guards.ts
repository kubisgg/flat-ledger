import type { H3Event } from 'h3'
import { createError } from 'h3'
import { requireAdmin } from './guards'

export function appUrl() {
  return new URL(process.env.AUTH_URL || 'http://localhost:3000')
}

export function mcpServerUrls() {
  const additional = (process.env.MCP_SERVER_URLS || '').split(',').map(value => value.trim()).filter(Boolean)
  const origins = additional.map((value) => {
    let url: URL
    try {
      url = new URL(value)
    } catch {
      throw createError({ statusCode: 503, statusMessage: 'MCP_SERVER_URLS must contain HTTP(S) server URLs separated by commas' })
    }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
      throw createError({ statusCode: 503, statusMessage: 'MCP_SERVER_URLS must contain HTTP(S) server URLs without paths, credentials, queries or fragments' })
    }
    return url.origin
  })
  return [...new Set([appUrl().origin, ...origins])]
}

export function isMcpOriginAllowed(origin: string | undefined) {
  return !origin || mcpServerUrls().includes(origin)
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
