import { closeMcpHandler } from '../mcp/server'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('close', closeMcpHandler)
})
