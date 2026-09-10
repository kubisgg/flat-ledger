import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { request } from 'node:http'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'

// Run against the production build, with a private database and listener.
test('MCP HTTP security boundaries', { timeout: 60000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'flat-ledger-security-'))
  const listener = createServer().listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const port = listener.address().port
  await new Promise(resolve => listener.close(resolve))
  const base = `http://127.0.0.1:${port}`
  const server = spawn(process.execPath, ['.output/server/index.mjs'], {
    env: {
      ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
      NITRO_HOST: '127.0.0.1', NITRO_PORT: String(port), DATABASE_URL: join(directory, 'ledger.sqlite'),
      AUTH_URL: base, MCP_SERVER_URLS: ` https://mcp.example.com/, ,http://ledger.lan:3000,https://MCP.EXAMPLE.COM:443,${base}, `,
      AUTH_SECRET: randomBytes(32).toString('hex'), ADMIN_EMAIL: '', ADMIN_PASSWORD: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let logs = ''
  server.stdout.on('data', data => logs += data)
  server.stderr.on('data', data => logs += data)
  t.after(async () => {
    if (server.exitCode === null) {
      const stopped = once(server, 'exit')
      server.kill('SIGTERM')
      await stopped
    }
    await rm(directory, { recursive: true, force: true })
  })
  let ready = false
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null) throw new Error(logs)
    try {
      if ((await fetch(`${base}/api/session`)).ok) {
        ready = true
        break
      }
    } catch { /* Listener is starting. */ }
    await delay(100)
  }
  assert.ok(ready, logs)
  const account = { email: 'security@example.local', password: randomBytes(24).toString('hex'), name: 'Security test' }
  async function api(path, method = 'GET', body, headers = {}) {
    return fetch(`${base}${path}`, {
      method, headers: { 'Content-Type': 'application/json', ...headers },
      ...(body !== undefined && { body: JSON.stringify(body) })
    })
  }
  assert.equal((await api('/api/auth/sign-up/email', 'POST', account, { Origin: base })).status, 200)
  const signedIn = await api('/api/auth/sign-in/email', 'POST', account, { Origin: base })
  assert.equal(signedIn.status, 200)
  const cookie = signedIn.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
  assert.ok(cookie)
  assert.equal((await api('/api/settings/mcp', 'PUT', { enabled: true }, { cookie })).status, 200)
  const token = (await (await api('/api/settings/mcp/token', 'GET', undefined, { cookie })).json()).token
  assert.match(token, /^flmcp_[A-Za-z0-9_-]{43}$/)

  function raw(headers = {}, body = '{}', method = 'POST', chunked = false) {
    return new Promise((resolve, reject) => {
      const req = request(`${base}/mcp`, {
        method, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, ...headers }
      }, (response) => {
        let text = ''
        response.setEncoding('utf8')
        response.on('data', chunk => text += chunk)
        response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, text }))
      })
      req.on('error', reject)
      if (chunked) {
        for (let offset = 0; offset < body.length; offset += 1024) req.write(body.slice(offset, offset + 1024))
        req.end()
      } else req.end(body)
    })
  }

  await t.test('settings list unique endpoints and every configured host and origin serves MCP', async () => {
    const settings = await (await api('/api/settings/mcp', 'GET', undefined, { cookie })).json()
    assert.deepEqual(settings.endpoints, [`${base}/mcp`, 'https://mcp.example.com/mcp', 'http://ledger.lan:3000/mcp'])
    const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
      protocolVersion: '2026-07-28', capabilities: {}, clientInfo: { name: 'origins-test', version: '1.0.0' }
    } })
    for (const endpoint of settings.endpoints) {
      const url = new URL(endpoint)
      for (const originHeaders of [{}, { Origin: url.origin }]) {
        const response = await raw({ Host: url.host, Accept: 'application/json, text/event-stream', ...originHeaders }, body)
        assert.equal(response.status, 200, endpoint)
        const payload = response.headers['content-type']?.includes('text/event-stream')
          ? response.text.split('\n').find(line => line.startsWith('data: ')).slice(6)
          : response.text
        assert.equal(JSON.parse(payload).result.serverInfo.name, 'flat-ledger')
      }
      assert.equal((await raw({ Host: url.host, Origin: url.origin, Authorization: '' }, body)).status, 401)
    }
    for (const Origin of ['https://mcp.example.com.evil.example', 'http://mcp.example.com', 'http://ledger.lan:3001']) {
      assert.equal((await raw({ Origin }, body)).status, 403, Origin)
    }
    assert.equal((await raw({ Host: 'mcp.example.com.evil.example' }, body)).status, 403)
  })

  await t.test('signup remains closed after the owner exists', async () => {
    const second = { ...account, email: 'second@example.local' }
    for (const path of ['/api/auth/sign-up/email', '/api/auth/sign-up/email/', '/api/auth/sign-up/email?next=/']) {
      assert.equal((await api(path, 'POST', second, { Origin: base })).status, 403, path)
    }
  })

  await t.test('every management route rejects foreign or null origins without mutating the token', async () => {
    for (const [path, method, body] of [
      ['/api/settings/mcp', 'GET'], ['/api/settings/mcp', 'PUT', { enabled: false }],
      ['/api/settings/mcp/token', 'GET'], ['/api/settings/mcp/token', 'POST']
    ]) {
      for (const Origin of ['null', 'https://evil.example', `${base}.evil.example`]) {
        const response = await api(path, method, body, { cookie, Origin })
        assert.equal(response.status, 403, `${method} ${path}, ${Origin}`)
        assert.equal(response.headers.get('cache-control'), 'no-store')
      }
    }
    assert.equal((await (await api('/api/settings/mcp/token', 'GET', undefined, { cookie })).json()).token, token)
    assert.equal((await (await api('/api/settings/mcp', 'GET', undefined, { cookie })).json()).enabled, true)
  })

  await t.test('cookies, query parameters and malformed bearer tokens do not grant MCP access', async () => {
    for (const Authorization of ['', token, `Basic ${token}`, `Bearer ${token.slice(0, -1)}`, `Bearer ${token}x`, `Bearer ${token}, Bearer ${token}`, `Bearer  ${token}`]) {
      const response = await raw({ Authorization, cookie })
      assert.equal(response.status, 401, Authorization)
      assert.equal(response.headers['cache-control'], 'no-store')
      assert.equal(response.headers['www-authenticate'], 'Bearer realm="flat-ledger-mcp"')
      assert.equal(response.text.includes(token), false)
    }
    assert.equal((await api(`/mcp?token=${token}`, 'POST', {}, { cookie })).status, 401)
    // Auth scheme names are case-insensitive; token bytes remain case-sensitive.
    assert.equal((await raw({ Authorization: `bEaReR ${token}` }, '{')).status, 400)
    const mutated = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')
    assert.equal((await raw({ Authorization: `Bearer ${mutated}` })).status, 401)
  })

  await t.test('host and origin checks reject spoofing despite forwarded headers', async () => {
    for (const Host of ['evil.example', '127.0.0.1.evil.example', '127.0.0.1@evil.example']) {
      const response = await raw({ Host, 'X-Forwarded-Host': `127.0.0.1:${port}` })
      assert.equal(response.status, 403, Host)
    }
    for (const Origin of ['null', 'https://evil.example', `http://127.0.0.1:${port + 1}`]) {
      assert.equal((await raw({ Origin })).status, 403, Origin)
    }
  })

  await t.test('request limit counts streamed bytes and rejects malformed JSON consistently', async () => {
    for (const body of ['', '{', ' '.repeat(65536)]) {
      const response = await raw({}, body)
      assert.equal(response.status, 400)
      assert.equal(JSON.parse(response.text).error.code, -32700)
    }
    for (const body of [' '.repeat(65537), JSON.stringify({ text: 'ą'.repeat(33000) })]) {
      const response = await raw({}, body, 'POST', true)
      assert.equal(response.status, 413)
      assert.equal(response.headers['cache-control'], 'no-store')
    }
    assert.equal((await raw({}, '{')).status, 400, 'server still accepts requests after rejecting large bodies')
  })

  await t.test('repeated enable keeps the token and parallel resets leave only the final token valid', async () => {
    assert.equal((await api('/api/settings/mcp', 'PUT', { enabled: true }, { cookie })).status, 200)
    assert.equal((await (await api('/api/settings/mcp/token', 'GET', undefined, { cookie })).json()).token, token)
    const resets = await Promise.all(Array.from({ length: 5 }, () => api('/api/settings/mcp/token', 'POST', undefined, { cookie })))
    const tokens = await Promise.all(resets.map(async (response) => {
      assert.equal(response.status, 200)
      return (await response.json()).token
    }))
    assert.equal(new Set(tokens).size, 5)
    const current = (await (await api('/api/settings/mcp/token', 'GET', undefined, { cookie })).json()).token
    assert.ok(tokens.includes(current))
    for (const candidate of [token, ...tokens]) {
      assert.equal((await raw({ Authorization: `Bearer ${candidate}` }, '{')).status, candidate === current ? 400 : 401)
    }
    assert.equal(logs.includes(current), false)
  })
})

for (const secret of ['', 'short-secret', 'change-this-long-random-secret']) {
  test(`MCP refuses token generation with ${secret ? 'weak' : 'missing'} AUTH_SECRET: ${secret || '(unset)'}`, { timeout: 30000 }, async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'flat-ledger-secret-'))
    const listener = createServer().listen(0, '127.0.0.1')
    await once(listener, 'listening')
    const port = listener.address().port
    await new Promise(resolve => listener.close(resolve))
    const base = `http://127.0.0.1:${port}`
    const environment = {
      ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
      NITRO_HOST: '127.0.0.1', NITRO_PORT: String(port), DATABASE_URL: join(directory, 'ledger.sqlite'),
      AUTH_URL: base, ADMIN_EMAIL: '', ADMIN_PASSWORD: ''
    }
    if (secret) environment.AUTH_SECRET = secret
    else delete environment.AUTH_SECRET
    const server = spawn(process.execPath, ['.output/server/index.mjs'], {
      env: environment, stdio: ['ignore', 'pipe', 'pipe']
    })
    let logs = ''
    server.stdout.on('data', data => logs += data)
    server.stderr.on('data', data => logs += data)
    t.after(async () => {
      if (server.exitCode === null) {
        const stopped = once(server, 'exit')
        server.kill('SIGTERM')
        await stopped
      }
      await rm(directory, { recursive: true, force: true })
    })
    let ready = false
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(logs)
      try {
        if ((await fetch(`${base}/api/session`)).ok) {
          ready = true
          break
        }
      } catch { /* Listener is starting. */ }
      await delay(100)
    }
    assert.ok(ready, logs)
    let cookie = ''
    async function api(path, method = 'GET', body) {
      return fetch(`${base}${path}`, {
        method, headers: { 'Content-Type': 'application/json', 'Origin': base, cookie },
        ...(body !== undefined && { body: JSON.stringify(body) })
      })
    }
    const account = { email: 'secret@example.local', password: randomBytes(24).toString('hex'), name: 'Secret test' }
    assert.equal((await api('/api/auth/sign-up/email', 'POST', account)).status, 200)
    const login = await api('/api/auth/sign-in/email', 'POST', account)
    assert.equal(login.status, 200)
    cookie = login.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
    assert.ok(cookie)
    async function assertUnconfigured() {
      const response = await api('/api/settings/mcp')
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      const settings = await response.json()
      assert.equal(settings.configured, false)
      assert.equal(settings.enabled, false)
      assert.equal(settings.hasToken, false)
      assert.equal(settings.tokenReadable, false)
    }
    await assertUnconfigured()
    for (const [path, method, body] of [
      ['/api/settings/mcp', 'PUT', { enabled: true }],
      ['/api/settings/mcp/token', 'POST']
    ]) {
      const response = await api(path, method, body)
      assert.equal(response.status, 503, `${method} ${path}`)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      await assertUnconfigured()
    }
    assert.equal((await api('/api/settings/mcp/token')).status, 409)
    assert.equal((await api('/api/settings/mcp', 'PUT', { enabled: false })).status, 200)
    await assertUnconfigured()
    assert.equal((await api('/mcp', 'POST', {})).status, 404)
  })
}
