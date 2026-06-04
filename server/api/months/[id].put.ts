import { eq } from 'drizzle-orm'
import { months } from '../../utils/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)

  return useDb().update(months).set({
    name: String(body.name || ''),
    year: Number(body.year),
    month: Number(body.month),
    isClosed: Boolean(body.isClosed),
    note: body.note || null,
    updatedAt: nowSql()
  }).where(eq(months.id, id)).returning().get()
})
