import { z } from 'zod'
import { setMcpEnabled } from '../../../services/mcp-settings'

export default defineEventHandler(async (event) => {
  await requireMcpSettingsAdmin(event)
  const result = z.object({ enabled: z.boolean() }).strict().safeParse(await readBody(event))
  if (!result.success) {
    throw createError({ statusCode: 400, statusMessage: 'Expected an enabled boolean' })
  }
  return setMcpEnabled(result.data.enabled)
})
