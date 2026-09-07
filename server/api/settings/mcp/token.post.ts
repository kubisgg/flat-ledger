import { resetMcpToken } from '../../../services/mcp-settings'

export default defineEventHandler(async (event) => {
  await requireMcpSettingsAdmin(event)
  return resetMcpToken()
})
