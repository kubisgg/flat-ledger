import { eq } from 'drizzle-orm'
import { paymentTypes } from '../../utils/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  useDb().delete(paymentTypes).where(eq(paymentTypes.id, id)).run()
  return { ok: true }
})
