import { getDashboard } from '../services/ledger'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return getDashboard()
})
