import { sumTransferCharges } from '#shared/utils/transfer'
import { asc, count, desc, eq, sql } from 'drizzle-orm'
import { createError } from 'h3'
import { useDb } from '../utils/db'
import { meterReadings, months, paymentTypes, payments } from '../utils/schema'

export function getDashboard() {
  const db = useDb()
  const currentMonth = db.select().from(months).orderBy(desc(months.year), desc(months.month)).limit(1).get()

  if (!currentMonth) {
    return {
      month: null,
      total: 0,
      paid: false,
      payments: []
    }
  }

  const rows = db.select().from(payments).where(eq(payments.monthId, currentMonth.id)).all()
  const total = sumTransferCharges(rows)

  return {
    month: currentMonth,
    total,
    paid: currentMonth.isClosed,
    payments: rows,
    openMonths: db.select({ count: sql<number>`count(*)` }).from(months).where(eq(months.isClosed, false)).get()?.count || 0
  }
}

export function listMonths(page = 1, limit = 10) {
  const db = useDb()

  const total = db.select({ count: count() }).from(months).get()?.count ?? 0
  const data = db.select().from(months).orderBy(desc(months.year), desc(months.month)).limit(limit).offset((page - 1) * limit).all()

  return { data, total }
}

export function getMonth(id: number) {
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
}

export function getMeterHistory() {
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
    let change: { text: string, sign: number } | null = null
    if (previous) {
      if (previous.usage > 0) {
        const pct = Math.round(((current.usage - previous.usage) / previous.usage) * 100)
        change = { text: `${pct > 0 ? '+' : ''}${pct}%`, sign: Math.sign(pct) }
      } else {
        const delta = current.usage - previous.usage
        change = { text: `${delta > 0 ? '+' : ''}${delta} ${current.unit}`, sign: Math.sign(delta) }
      }
    }

    result.push({
      id: current.typeId,
      name: current.typeName,
      unit: current.unit,
      currentUsage: current.usage,
      previousUsage: previous?.usage ?? null,
      change,
      history: last13.slice(-12).map(r => ({
        month: r.month,
        year: r.year,
        usage: r.usage,
        label: `${String(r.month).padStart(2, '0')}.${r.year}`
      }))
    })
  }

  return result
}

export function listChargeTypes() {
  return useDb().select().from(paymentTypes).orderBy(asc(paymentTypes.name)).all()
}
