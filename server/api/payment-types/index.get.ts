import { asc } from 'drizzle-orm'
import { paymentTypes } from '../../utils/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return useDb().select().from(paymentTypes).orderBy(asc(paymentTypes.name)).all()
})
