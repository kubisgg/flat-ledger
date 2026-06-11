import { count } from 'drizzle-orm'
import { auth } from '../../utils/auth'
import { users } from '../../utils/schema'

export default defineEventHandler(async (event) => {
  const path = event.path

  if (path.includes('/api/auth/sign-up')) {
    const db = useDb()
    const existing = db.select({ count: count() }).from(users).get()

    if ((existing?.count || 0) > 0) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Registration is closed'
      })
    }
  }

  const nodeReq = event.node.req
  const method = nodeReq.method || 'GET'
  const url = new URL(nodeReq.url!, `http://${nodeReq.headers.host || 'localhost'}`)
  const headers = new Headers(nodeReq.headers as HeadersInit)
  const request = new Request(url, {
    method,
    headers,
    ...(method !== 'GET' && method !== 'HEAD' && {
      body: nodeReq as unknown as BodyInit,
      duplex: 'half'
    })
  })

  return auth.handler(request)
})
