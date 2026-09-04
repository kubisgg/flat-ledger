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

  const meterUpdates = rows.flatMap((row) => {
    const key = String(row.payment.id)
    if (!Object.hasOwn(currentReadings, key)) return []

    const rawValue = currentReadings[key]
    if ((typeof rawValue !== 'number' && typeof rawValue !== 'string') || (typeof rawValue === 'string' && rawValue.trim() === '')) {
      throw createError({ statusCode: 400, statusMessage: `Invalid meter reading for ${row.payment.name}` })
    }

    const currentValue = Number(rawValue)
    if (!Number.isFinite(currentValue) || currentValue < row.meter.previousValue) {
      throw createError({ statusCode: 400, statusMessage: `Invalid meter reading for ${row.payment.name}` })
    }

    const usage = currentValue - row.meter.previousValue
    const amount = floorMoney(usage * row.meter.unitPrice)

    return [{ row, currentValue, usage, amount }]
  })

  for (const { row, currentValue, usage, amount } of meterUpdates) {
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
