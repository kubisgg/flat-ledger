import { paymentTypes } from '../../utils/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const kind = ['fixed', 'metered', 'variable'].includes(String(body.kind)) ? String(body.kind) : (body.isMetered ? 'metered' : 'fixed')

  return useDb().insert(paymentTypes).values({
    name: String(body.name || ''),
    kind: kind as 'fixed' | 'metered' | 'variable',
    isMetered: kind === 'metered',
    isRequired: body.isRequired !== false,
    defaultActive: body.defaultActive === true,
    defaultAmount: body.defaultAmount === '' ? null : Number(body.defaultAmount || 0),
    unitPrice: body.unitPrice === '' ? null : Number(body.unitPrice || 0),
    unit: body.unit || null,
    notes: body.notes || null
  }).returning().get()
})
