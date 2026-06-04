import { desc, eq, sql } from 'drizzle-orm'
import { months, payments } from '../utils/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()
  const currentMonth = db.select().from(months).orderBy(desc(months.year), desc(months.month)).limit(1).get()

  if (!currentMonth) {
    return {
      month: null,
      total: 0,
      paid: 0,
      remaining: 0,
      status: 'unpaid',
      payments: []
    }
  }

  const rows = db.select().from(payments).where(eq(payments.monthId, currentMonth.id)).all()
  const total = rows.filter(payment => payment.isRequired).reduce((sum, payment) => sum + payment.amount, 0)
  const paid = currentMonth.isClosed ? total : 0
  const remaining = Math.max(total - paid, 0)
  const status = currentMonth.isClosed ? 'paid' : 'unpaid'

  return {
    month: currentMonth,
    total,
    paid,
    remaining,
    status,
    payments: rows,
    openMonths: db.select({ count: sql<number>`count(*)` }).from(months).where(eq(months.isClosed, false)).get()?.count || 0
  }
})
