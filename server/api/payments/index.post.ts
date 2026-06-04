import { eq } from 'drizzle-orm'
import { meterReadings, paymentTypes, payments } from '../../utils/schema'

function paymentValues(body: Record<string, unknown>) {
  const isMetered = Boolean(body.isMetered)
  const previousValue = toNumber(body.previousValue)
  const currentValue = toNumber(body.currentValue)
  const unitPrice = toNumber(body.unitPrice)
  const usage = Math.max(currentValue - previousValue, 0)
  const calculatedAmount = isMetered ? floorMoney(usage * unitPrice) : null
  const amount = floorMoney(body.isManualAmount ? toNumber(body.amount) : calculatedAmount ?? toNumber(body.amount))

  return { isMetered, previousValue, currentValue, unitPrice, usage, calculatedAmount, amount }
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const db = useDb()
  const type = body.paymentTypeId ? db.select().from(paymentTypes).where(eq(paymentTypes.id, Number(body.paymentTypeId))).get() : null
  const values = paymentValues({
    ...body,
    isMetered: type?.isMetered || body.isMetered,
    unitPrice: body.unitPrice ?? type?.unitPrice,
    amount: body.amount ?? type?.defaultAmount
  })

  const payment = db.insert(payments).values({
    monthId: Number(body.monthId),
    paymentTypeId: body.paymentTypeId ? Number(body.paymentTypeId) : null,
    name: String(body.name || type?.name || ''),
    amount: values.amount,
    calculatedAmount: values.calculatedAmount,
    isManualAmount: Boolean(body.isManualAmount),
    isRequired: body.isRequired !== false,
    note: body.note || null
  }).returning().get()

  if (values.isMetered) {
    db.insert(meterReadings).values({
      paymentId: payment.id,
      previousValue: values.previousValue,
      currentValue: values.currentValue,
      usage: values.usage,
      unitPrice: values.unitPrice,
      unit: body.unit || type?.unit || null
    }).run()
  }

  return payment
})
