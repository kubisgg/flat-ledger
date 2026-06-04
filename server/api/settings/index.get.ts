import { appSettings } from '../../utils/schema'

const defaults = {
  transferTitle: 'en. {energia}, zw. {zimna_woda}'
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const rows = useDb().select().from(appSettings).all()
  const values = Object.fromEntries(rows.map(row => [row.key, row.value]))

  return {
    transferTitle: values.transfer_title || defaults.transferTitle
  }
})
