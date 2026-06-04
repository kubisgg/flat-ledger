import { count, desc, eq } from 'drizzle-orm'
import { meterReadings, months, paymentTypes, payments } from '../../utils/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  const monthId = query.monthId && query.monthId !== 'all' ? Number(query.monthId) : null
  const page = Math.max(1, Number(query.page) || 1)
  const limit = 10
  const db = useDb()

  const total = monthId
    ? db.select({ count: count() }).from(payments).where(eq(payments.monthId, monthId)).get()?.count ?? 0
    : db.select({ count: count() }).from(payments).get()?.count ?? 0

  const base = db.select({
    payment: payments,
    month: months,
    type: paymentTypes,
    meter: meterReadings
  })
    .from(payments)
    .leftJoin(months, eq(payments.monthId, months.id))
    .leftJoin(paymentTypes, eq(payments.paymentTypeId, paymentTypes.id))
    .leftJoin(meterReadings, eq(payments.id, meterReadings.paymentId))

  const rows = monthId
    ? base.where(eq(payments.monthId, monthId)).orderBy(desc(payments.id)).limit(limit).offset((page - 1) * limit).all()
    : base.orderBy(desc(payments.id)).limit(limit).offset((page - 1) * limit).all()

  return {
    data: rows.map(row => ({ ...row.payment, month: row.month, type: row.type, meter: row.meter })),
    total
  }
})
