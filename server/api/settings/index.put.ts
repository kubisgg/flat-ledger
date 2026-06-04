import { appSettings } from '../../utils/schema'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const body = await readBody(event)
  const transferTitle = String(body.transferTitle || '').trim()
  const db = useDb()

  db.insert(appSettings).values({
    key: 'transfer_title',
    value: transferTitle,
    updatedAt: nowSql()
  }).onConflictDoUpdate({
    target: appSettings.key,
    set: {
      value: transferTitle,
      updatedAt: nowSql()
    }
  }).run()

  return { transferTitle }
})
