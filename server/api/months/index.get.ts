import { listMonths } from '../../services/ledger'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(Number(query.itemsPerPage) || 10, 500)
  return listMonths(page, limit)
})
