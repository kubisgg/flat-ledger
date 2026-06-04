import { eq } from 'drizzle-orm'
import { payments } from '../../utils/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  useDb().delete(payments).where(eq(payments.id, id)).run()
  return { ok: true }
})
