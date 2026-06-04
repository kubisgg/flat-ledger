import { eq } from 'drizzle-orm'
import { months } from '../../utils/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  useDb().delete(months).where(eq(months.id, id)).run()
  return { ok: true }
})
