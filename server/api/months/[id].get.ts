import { eq } from 'drizzle-orm'
import { meterReadings, months, paymentTypes, payments } from '../../utils/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  const month = useDb().select().from(months).where(eq(months.id, id)).get()

  if (!month) {
    throw createError({ statusCode: 404, statusMessage: 'Month not found' })
  }

  const rows = useDb()
    .select({
      payment: payments,
      type: paymentTypes,
      meter: meterReadings
    })
    .from(payments)
    .leftJoin(paymentTypes, eq(payments.paymentTypeId, paymentTypes.id))
    .leftJoin(meterReadings, eq(payments.id, meterReadings.paymentId))
    .where(eq(payments.monthId, id))
    .all()

  return {
    month,
    payments: rows.map(row => ({ ...row.payment, type: row.type, meter: row.meter }))
  }
})
