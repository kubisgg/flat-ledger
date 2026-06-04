import { getHeaders } from 'h3'
import { auth } from '../utils/auth'

export default defineEventHandler(async (event) => {
  return auth.api.getSession({
    headers: new Headers(getHeaders(event) as HeadersInit)
  })
})
