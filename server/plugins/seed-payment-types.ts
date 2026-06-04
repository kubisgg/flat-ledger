import { count } from 'drizzle-orm'
import { paymentTypes } from '../utils/schema'

export default defineNitroPlugin(() => {
  const db = useDb()
  const existing = db.select({ count: count() }).from(paymentTypes).get()

  if ((existing?.count || 0) > 0) {
    return
  }

  db.insert(paymentTypes).values([
    { name: 'Czynsz', kind: 'fixed' as const, isMetered: false, isRequired: true, defaultAmount: 100 },
    { name: 'Parking', kind: 'fixed' as const, isMetered: false, isRequired: false, defaultAmount: 100 },
    { name: 'Ogrzewanie', kind: 'variable' as const, isMetered: false, isRequired: false, defaultAmount: 0 },
    { name: 'Energia', kind: 'metered' as const, isMetered: true, isRequired: true, unitPrice: 1.5, unit: 'kWh' },
    { name: 'Woda', kind: 'metered' as const, isMetered: true, isRequired: true, unitPrice: 15.25, unit: 'm3' },
    { name: 'Internet', kind: 'fixed' as const, isMetered: false, isRequired: false, defaultAmount: 30 },
    { name: 'Inne', kind: 'variable' as const, isMetered: false, isRequired: false, defaultAmount: 0 }
  ]).run()
})
