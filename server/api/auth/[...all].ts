import { count } from 'drizzle-orm'
import { toWebRequest } from 'h3'
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

  return auth.handler(toWebRequest(event))
})
