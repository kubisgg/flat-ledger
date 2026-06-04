import { eq } from 'drizzle-orm'
import { payments } from '../../../utils/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)

  return useDb().update(payments).set({
    isRequired: body.isRequired !== false,
    updatedAt: nowSql()
  }).where(eq(payments.id, id)).returning().get()
})
