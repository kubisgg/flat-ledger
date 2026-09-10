import { toNodeHandler } from '@modelcontextprotocol/node'
import { validateHostHeader } from '@modelcontextprotocol/server'
import { getMcpHandler } from '../mcp/server'
import { verifyMcpToken } from '../services/mcp-settings'

import { mcpServerUrls, isMcpOriginAllowed } from '../utils/mcp-guards'

function httpError(status: number, message: string, headers: Record<string, string> = {}, code = -32000) {
  return Response.json({ jsonrpc: '2.0', id: null, error: { code, message } }, {
    status,
    headers: { 'Cache-Control': 'no-store', ...headers }
  })
}

export default defineEventHandler(async (event) => {
  event.node.res.setHeader('Cache-Control', 'no-store')
  const hostnames = mcpServerUrls().map(origin => new URL(origin).hostname)
  if (!validateHostHeader(event.node.req.headers.host, hostnames).ok) {
    return httpError(403, 'Invalid host')
  }
  const origin = event.node.req.headers.origin
  if (!isMcpOriginAllowed(origin)) return httpError(403, 'Invalid origin')

  const access = verifyMcpToken(event.node.req.headers.authorization)
  if (access === 'disabled') {
    return httpError(404, 'MCP is disabled')
  }
  if (access !== 'authorized') {
    return httpError(401, 'Invalid MCP token', { 'WWW-Authenticate': 'Bearer realm="flat-ledger-mcp"' })
  }
  if (event.node.req.method !== 'POST') {
    return httpError(405, 'Method not allowed', { Allow: 'POST' })
  }

  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of event.node.req.iterator({ destroyOnReturn: false })) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > 64 * 1024) {
      event.node.req.resume()
      return httpError(413, 'MCP request too large')
    }
    chunks.push(buffer)
  }
  let body: unknown
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return httpError(400, 'Parse error', {}, -32700)
  }
  await toNodeHandler(getMcpHandler())(event.node.req, event.node.res, body)
})
