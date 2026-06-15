import { and, desc, eq } from 'drizzle-orm'
import { meterReadings, months, paymentTypes, payments } from '../../utils/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const db = useDb()
  const currentReadings = (body.currentReadings || {}) as Record<string, unknown>
  const variableAmounts = (body.variableAmounts || {}) as Record<string, unknown>

  const existing = db.select({ id: months.id }).from(months)
    .where(and(eq(months.year, Number(body.year)), eq(months.month, Number(body.month))))
    .get()
  if (existing) {
    throw createError({ statusCode: 409, message: 'That month already exists' })
  }

  const inserted = db.insert(months).values({
    name: String(body.name || ''),
    year: Number(body.year),
    month: Number(body.month),
    note: body.note || null
  }).returning().get()

  const templates = db.select().from(paymentTypes).all()

  for (const type of templates) {
    const payment = db.insert(payments).values({
      monthId: inserted.id,
      paymentTypeId: type.id,
      name: type.name,
      amount: type.kind === 'variable' ? floorMoney(toNumber(variableAmounts[String(type.id)], type.defaultAmount || 0)) : type.defaultAmount || 0,
      calculatedAmount: null,
      isManualAmount: type.kind !== 'metered',
      isRequired: type.isRequired || Boolean(type.defaultActive),
      note: type.notes || null
    }).returning().get()

    if (type.kind === 'metered') {
      const previousReading = db
        .select({ currentValue: meterReadings.currentValue })
        .from(payments)
        .innerJoin(meterReadings, eq(payments.id, meterReadings.paymentId))
        .where(and(eq(payments.paymentTypeId, type.id), eq(payments.name, type.name)))
        .orderBy(desc(payments.id))
        .limit(1)
        .get()
      const previousValue = previousReading?.currentValue || 0
      const currentValue = toNumber(currentReadings[String(type.id)], previousValue)
      const usage = Math.max(currentValue - previousValue, 0)
      const amount = floorMoney(usage * (type.unitPrice || 0))

      db.update(payments).set({
        amount,
        calculatedAmount: amount,
        isManualAmount: false
      }).where(eq(payments.id, payment.id)).run()

      db.insert(meterReadings).values({
        paymentId: payment.id,
        previousValue,
        currentValue,
        usage,
        unitPrice: type.unitPrice || 0,
        unit: type.unit || null
      }).run()
    }
  }

  return inserted
})
