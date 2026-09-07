import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { createError } from 'h3'
import { useDb } from '../utils/db'
import { appSettings } from '../utils/schema'
import { appUrl } from '../utils/mcp-guards'

interface McpConfig {
  enabled: boolean
  encryptedToken: string | null
}

const settingKey = 'mcp_config'

function encryptionKey() {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32 || secret === 'change-this-long-random-secret') {
    throw createError({ statusCode: 503, statusMessage: 'Configure a random AUTH_SECRET of at least 32 characters before using MCP' })
  }
  return createHash('sha256').update(`flat-ledger:mcp:${secret}`).digest()
}

function readConfig(): McpConfig {
  const row = useDb().select().from(appSettings).where(eq(appSettings.key, settingKey)).get()
  return row ? JSON.parse(row.value) : { enabled: false, encryptedToken: null }
}

function writeConfig(config: McpConfig) {
  const value = JSON.stringify(config)
  const updatedAt = new Date().toISOString()
  useDb().insert(appSettings).values({ key: settingKey, value, updatedAt })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt } }).run()
}

function encryptToken(token: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), ciphertext].map(part => part.toString('base64url')).join('.')
}

function decryptToken(encryptedToken: string | null) {
  if (!encryptedToken) return null
  try {
    const parts = encryptedToken.split('.').map(part => Buffer.from(part, 'base64url'))
    const [iv, tag, ciphertext] = parts
    if (parts.length !== 3 || !iv || !tag || !ciphertext) return null
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}

export function getMcpSettings() {
  const config = readConfig()
  let configured = true
  try {
    encryptionKey()
  } catch {
    configured = false
  }
  return {
    enabled: config.enabled,
    hasToken: !!config.encryptedToken,
    tokenReadable: !!decryptToken(config.encryptedToken),
    configured,
    endpoint: new URL('/mcp', appUrl()).href
  }
}

export function setMcpEnabled(enabled: boolean) {
  const config = readConfig()
  if (enabled) {
    encryptionKey()
    if (!decryptToken(config.encryptedToken)) {
      config.encryptedToken = encryptToken(`flmcp_${randomBytes(32).toString('base64url')}`)
    }
  }
  writeConfig({ ...config, enabled })
  return getMcpSettings()
}

export function resetMcpToken() {
  const config = readConfig()
  const token = `flmcp_${randomBytes(32).toString('base64url')}`
  writeConfig({ ...config, encryptedToken: encryptToken(token) })
  return { token }
}

export function getMcpToken() {
  const token = decryptToken(readConfig().encryptedToken)
  if (!token) {
    throw createError({ statusCode: 409, statusMessage: 'Generate a new MCP token in settings' })
  }
  return { token }
}

export function verifyMcpToken(authorization: string | undefined) {
  const config = readConfig()
  if (!config.enabled) return 'disabled'
  const supplied = /^Bearer (flmcp_[A-Za-z0-9_-]{43})$/i.exec(authorization || '')?.[1]
  const expected = decryptToken(config.encryptedToken)
  if (!supplied || !expected) return 'unauthorized'
  return timingSafeEqual(
    createHash('sha256').update(supplied).digest(),
    createHash('sha256').update(expected).digest()
  )
    ? 'authorized'
    : 'unauthorized'
}
