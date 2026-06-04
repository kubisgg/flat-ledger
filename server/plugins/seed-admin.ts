import { count } from 'drizzle-orm'
import { auth } from '../utils/auth'
import { users } from '../utils/schema'

export default defineNitroPlugin(async () => {
  const db = useDb()
  const existing = db.select({ count: count() }).from(users).get()

  if ((existing?.count || 0) > 0) {
    return
  }

  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD

  if (!adminEmail || !adminPassword) {
    console.warn('[flat-ledger] ADMIN_EMAIL/ADMIN_PASSWORD is not set. Admin account not created.')
    return
  }

  await auth.api.signUpEmail({
    body: {
      email: adminEmail,
      password: adminPassword,
      name: process.env.ADMIN_NAME || 'Admin'
    }
  })
})
