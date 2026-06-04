import { desc, eq } from 'drizzle-orm'
import { meterReadings, months, paymentTypes, payments } from '../../utils/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const db = useDb()

  const rows = db.select({
    typeId: paymentTypes.id,
    typeName: paymentTypes.name,
    unit: paymentTypes.unit,
    year: months.year,
    month: months.month,
    usage: meterReadings.usage
  })
    .from(meterReadings)
    .innerJoin(payments, eq(meterReadings.paymentId, payments.id))
    .innerJoin(months, eq(payments.monthId, months.id))
    .innerJoin(paymentTypes, eq(payments.paymentTypeId, paymentTypes.id))
    .where(eq(paymentTypes.isMetered, true))
    .orderBy(desc(months.year), desc(months.month))
    .all()

  const byType = new Map<number, typeof rows>()
  for (const row of rows) {
    if (!byType.has(row.typeId)) byType.set(row.typeId, [])
    byType.get(row.typeId)!.push(row)
  }

  const result = []
  for (const [, entries] of byType) {
    const last13 = entries.slice(0, 13).reverse()
    const current = last13[last13.length - 1]
    if (!current) continue
    const previous = last13[last13.length - 2]
    const changePercent = previous && previous.usage > 0
      ? Math.round(((current.usage - previous.usage) / previous.usage) * 100)
      : null

    result.push({
      id: current.typeId,
      name: current.typeName,
      unit: current.unit,
      currentUsage: current.usage,
      previousUsage: previous?.usage ?? null,
      changePercent,
      history: last13.slice(-12).map(r => ({
        month: r.month,
        year: r.year,
        usage: r.usage,
        label: `${String(r.month).padStart(2, '0')}.${r.year}`
      }))
    })
  }

  return result
})
