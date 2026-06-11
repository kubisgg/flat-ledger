import { auth } from '../utils/auth'

export default defineEventHandler(async (event) => {
  return auth.api.getSession({
    headers: new Headers(event.node.req.headers as HeadersInit)
  })
})
