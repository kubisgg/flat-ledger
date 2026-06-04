import { count, desc } from 'drizzle-orm'
import { months } from '../../utils/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(Number(query.itemsPerPage) || 10, 500)
  const db = useDb()

  const total = db.select({ count: count() }).from(months).get()?.count ?? 0
  const data = db.select().from(months).orderBy(desc(months.year), desc(months.month)).limit(limit).offset((page - 1) * limit).all()

  return { data, total }
})
