import { listChargeTypes } from '../../services/ledger'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return listChargeTypes()
})
