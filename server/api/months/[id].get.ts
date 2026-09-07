import { getMonth } from '../../services/ledger'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  return getMonth(id)
})
