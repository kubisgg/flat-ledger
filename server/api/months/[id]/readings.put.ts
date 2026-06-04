import { and, eq } from 'drizzle-orm'
import { meterReadings, payments } from '../../../utils/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const monthId = Number(getRouterParam(event, 'id'))
  const body = await readBody(event)
  const currentReadings = (body.currentReadings || {}) as Record<string, unknown>
  const variableAmounts = (body.variableAmounts || {}) as Record<string, unknown>
  const notes = (body.notes || {}) as Record<string, string>
  const db = useDb()

  const rows = db
    .select({
      payment: payments,
      meter: meterReadings
    })
    .from(payments)
    .innerJoin(meterReadings, eq(payments.id, meterReadings.paymentId))
    .where(eq(payments.monthId, monthId))
    .all()

  for (const row of rows) {
    const currentValue = toNumber(currentReadings[String(row.payment.id)], row.meter.currentValue)
    const usage = Math.max(currentValue - row.meter.previousValue, 0)
    const amount = floorMoney(usage * row.meter.unitPrice)

    db.update(meterReadings).set({
      currentValue,
      usage,
      updatedAt: nowSql()
    }).where(eq(meterReadings.id, row.meter.id)).run()

    db.update(payments).set({
      amount,
      calculatedAmount: amount,
      isManualAmount: false,
      updatedAt: nowSql()
    }).where(eq(payments.id, row.payment.id)).run()
  }

  for (const [paymentId, value] of Object.entries(variableAmounts)) {
    const amount = floorMoney(toNumber(value))

    db.update(payments).set({
      amount,
      calculatedAmount: null,
      isManualAmount: true,
      updatedAt: nowSql()
    }).where(and(eq(payments.id, Number(paymentId)), eq(payments.monthId, monthId))).run()
  }

  for (const [paymentId, note] of Object.entries(notes)) {
    db.update(payments).set({
      note: note || null,
      updatedAt: nowSql()
    }).where(and(eq(payments.id, Number(paymentId)), eq(payments.monthId, monthId))).run()
  }

  return { ok: true }
})
