import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { request } from 'node:http'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { test } from 'node:test'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

test('MCP settings and stateless HTTP integration', { timeout: 60000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'flat-ledger-mcp-test-'))
  const listener = createServer().listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const port = listener.address().port
  await new Promise(resolve => listener.close(resolve))
  const base = `http://127.0.0.1:${port}`
  const database = join(directory, 'ledger.sqlite')
  const password = randomBytes(24).toString('hex')
  const authSecret = randomBytes(32).toString('hex')
  let server
  let logs = ''
  let cookie = ''

  async function stop() {
    if (server && server.exitCode === null) {
      const stopped = once(server, 'exit')
      server.kill('SIGTERM')
      await stopped
    }
  }

  t.after(async () => {
    await stop()
    await rm(directory, { recursive: true, force: true })
  })

  async function start(secret = authSecret) {
    logs = ''
    server = spawn(process.execPath, ['.output/server/index.mjs'], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: String(port),
        NITRO_HOST: '127.0.0.1',
        NITRO_PORT: String(port),
        DATABASE_URL: database,
        AUTH_URL: base,
        MCP_SERVER_URLS: '',
        AUTH_SECRET: secret,
        // Create the test account explicitly below; Nitro does not await async startup plugins.
        ADMIN_EMAIL: '',
        ADMIN_PASSWORD: ''
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })
    server.stdout.on('data', data => logs += data)
    server.stderr.on('data', data => logs += data)
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw new Error(`Server exited: ${logs}`)
      try {
        const response = await fetch(`${base}/api/session`)
        if (response.ok) return
      } catch {
        // The HTTP listener may not be ready while startup plugins run.
      }
      await delay(100)
    }
    throw new Error(`Server failed to start: ${logs}`)
  }

  async function api(path, { method = 'GET', body, authenticated = true, headers = {} } = {}) {
    return fetch(`${base}${path}`, {
      method,
      headers: { ...(authenticated && { cookie }), 'Content-Type': 'application/json', ...headers },
      ...(body !== undefined && { body: JSON.stringify(body) })
    })
  }

  async function json(path, options) {
    const response = await api(path, options)
    assert.equal(response.status, 200, `${path}: ${await response.clone().text()}`)
    return response.json()
  }

  async function login() {
    const response = await api('/api/auth/sign-in/email', {
      method: 'POST', authenticated: false,
      headers: { Origin: base },
      body: { email: 'mcp-test@example.local', password }
    })
    assert.equal(response.status, 200, await response.clone().text())
    cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
    assert.ok(cookie)
  }

  function rpc(token, name = 'get_latest_month_summary', args = {}, headers = {}) {
    return api('/mcp', {
      authenticated: false, method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json, text/event-stream',
        'MCP-Protocol-Version': '2026-07-28',
        'Mcp-Method': 'tools/call',
        'Mcp-Name': name,
        ...headers
      },
      body: {
        jsonrpc: '2.0', id: 1, method: 'tools/call',
        params: {
          name, arguments: args,
          _meta: {
            'io.modelcontextprotocol/protocolVersion': '2026-07-28',
            'io.modelcontextprotocol/clientInfo': { name: 'flat-ledger-test', version: '1.0.0' },
            'io.modelcontextprotocol/clientCapabilities': {}
          }
        }
      }
    })
  }

  await start()
  await json('/api/auth/sign-up/email', {
    method: 'POST', authenticated: false,
    headers: { Origin: base },
    body: { email: 'mcp-test@example.local', password, name: 'MCP test' }
  })
  await login()
  let token

  await t.test('disabled by default; management requires a browser session', async () => {
    const settings = await json('/api/settings/mcp')
    // The SDK warns about responseMode: 'json' while building the handler, so a missing warning
    // proves getMcpHandler() is still lazy. The matching positive assertion is further down.
    assert.equal(logs.includes('responseMode: \'json\''), false)
    assert.equal(settings.enabled, false)
    assert.equal(settings.hasToken, false)
    assert.deepEqual(settings.endpoints, [`${base}/mcp`])
    assert.equal((await rpc('invalid')).status, 404)
    for (const [path, method] of [
      ['/api/settings/mcp', 'GET'], ['/api/settings/mcp', 'PUT'],
      ['/api/settings/mcp/token', 'GET'], ['/api/settings/mcp/token', 'POST']
    ]) {
      assert.equal((await api(path, { method, authenticated: false })).status, 401)
    }
    assert.equal((await api('/api/settings/mcp', { method: 'PUT', body: { enabled: 'true' } })).status, 400)
    assert.equal((await api('/api/settings/mcp', {
      method: 'PUT', body: { enabled: true }, headers: { Origin: 'https://untrusted.example' }
    })).status, 403)
  })

  await t.test('enabling generates an encrypted token that can be retrieved again', async () => {
    const settings = await json('/api/settings/mcp', { method: 'PUT', body: { enabled: true } })
    assert.equal(settings.enabled, true)
    assert.equal(settings.tokenReadable, true)
    const response = await api('/api/settings/mcp/token')
    assert.equal(response.headers.get('cache-control'), 'no-store')
    token = (await response.json()).token
    assert.match(token, /^flmcp_[A-Za-z0-9_-]{43}$/)
    assert.equal((await json('/api/settings/mcp/token')).token, token)
    assert.equal((await readFile(database)).includes(Buffer.from(token)), false)
    assert.equal((await rpc('invalid')).status, 401)
    assert.equal((await api('/mcp', { method: 'POST', body: {} })).status, 401)
    assert.equal((await api('/api/settings/mcp/token', {
      authenticated: false, headers: { Authorization: `Bearer ${token}` }
    })).status, 401)
    assert.equal((await rpc(token, 'get_latest_month_summary', {}, { Origin: 'https://untrusted.example' })).status, 403)
    // fetch normalizes Host; use node:http to send an actual hostile Host header.
    const hostStatus = await new Promise((resolve, reject) => {
      const req = request(`${base}/mcp`, {
        method: 'POST', headers: { Host: 'untrusted.example', Authorization: `Bearer ${token}` }
      }, (response) => {
        response.resume()
        resolve(response.statusCode)
      })
      req.on('error', reject)
      req.end('{}')
    })
    assert.equal(hostStatus, 403)
  })

  await t.test('SDK client lists five read-only tools and presents API data with MCP field names', async () => {
    const emptyDashboard = await json('/api/dashboard')
    assert.equal(emptyDashboard.month, null)
    assert.equal(emptyDashboard.total, 0)
    assert.equal(emptyDashboard.paid, false)
    const emptySummary = await (await rpc(token)).json()
    assert.deepEqual(emptySummary.result?.structuredContent, {
      month: null, transferAmount: 0, roundedTransferAmount: 0, transferSent: false, charges: [], unsentMonthCount: 0
    }, JSON.stringify(emptySummary))
    await json('/api/months', { method: 'POST', body: { name: 'Test month', year: 2026, month: 9 } })
    const month = (await json('/api/months')).data[0]
    await json('/api/payments', {
      method: 'POST', body: { monthId: month.id, name: 'Fractional charge', amount: 10.5, isRequired: true }
    })
    const client = new Client({ name: 'flat-ledger-integration', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } }
    })
    try {
      await client.connect(transport)
      const { tools } = await client.listTools()
      assert.deepEqual(tools.map(tool => tool.name).sort(), ['get_latest_month_summary', 'get_meter_history', 'get_month_details', 'list_charge_types', 'list_months'])
      assert.ok(tools.every(tool => tool.annotations.readOnlyHint))
      const expectedMonth = {
        id: month.id, name: month.name, year: month.year, month: month.month,
        transferSent: month.isClosed, note: month.note
      }
      const expectedCharge = charge => ({
        id: charge.id, name: charge.name, amount: charge.amount,
        includedInTransfer: charge.isRequired, note: charge.note
      })
      const configuredTypes = await json('/api/payment-types')
      assert.ok(configuredTypes.every(type => !('notes' in type)))
      const dashboard = await json('/api/dashboard')
      const details = await json(`/api/months/${month.id}`)
      for (const [name, args, expected] of [
        ['get_latest_month_summary', {}, {
          month: expectedMonth, transferAmount: dashboard.total, roundedTransferAmount: Math.round(dashboard.total), transferSent: dashboard.paid,
          charges: dashboard.payments.map(expectedCharge), unsentMonthCount: dashboard.openMonths
        }],
        ['list_charge_types', {}, {
          chargeTypes: configuredTypes.map(type => ({
            id: type.id, name: type.name, kind: type.kind, required: type.isRequired,
            includedByDefault: type.isRequired || type.defaultActive,
            defaultAmount: type.defaultAmount, unitPrice: type.unitPrice, unit: type.unit
          }))
        }],
        ['list_months', { itemsPerPage: 10 }, { months: [expectedMonth], totalMonthCount: 1 }],
        ['get_month_details', { monthId: month.id }, {
          month: expectedMonth,
          transferAmount: dashboard.total, roundedTransferAmount: Math.round(dashboard.total),
          charges: details.payments.map(charge => ({
            ...expectedCharge(charge), calculatedAmount: charge.calculatedAmount,
            isManualAmount: charge.isManualAmount,
            chargeType: charge.type ? { id: charge.type.id, name: charge.type.name, kind: charge.type.kind } : null,
            meterReading: charge.meter
              ? {
                  previousValue: charge.meter.previousValue, currentValue: charge.meter.currentValue,
                  usage: charge.meter.usage, unitPrice: charge.meter.unitPrice, unit: charge.meter.unit
                }
              : null
          }))
        }],
        ['get_meter_history', {}, {
          meters: (await json('/api/dashboard/meter-history')).map(meter => ({
            id: meter.id, name: meter.name, unit: meter.unit,
            currentUsage: meter.currentUsage, previousUsage: meter.previousUsage,
            usageDelta: meter.previousUsage === null ? null : meter.currentUsage - meter.previousUsage,
            usageChangePercent: meter.previousUsage === null || meter.previousUsage === 0
              ? null
              : Number(((meter.currentUsage - meter.previousUsage) / meter.previousUsage * 100).toFixed(2)),
            history: meter.history.map(entry => ({ year: entry.year, month: entry.month, usage: entry.usage }))
          }))
        }]
      ]) {
        const result = await client.callTool({ name, arguments: args })
        assert.equal(result.isError, undefined, JSON.stringify(result.content))
        assert.deepEqual(result.structuredContent, expected)
        assert.deepEqual(JSON.parse(result.content[0].text), expected)
      }
      assert.equal(transport.sessionId, undefined)
    } finally {
      await client.close()
    }
    const concurrent = await Promise.all(Array.from({ length: 6 }, () => rpc(token)))
    for (const response of concurrent) {
      assert.equal(response.status, 200)
      assert.equal(response.headers.get('mcp-session-id'), null)
      assert.equal(response.headers.get('cache-control'), 'no-store')
      assert.ok((await response.json()).result)
    }
    // The handler is built by now, so the warning has to be there. This anchors the exact string the
    // laziness assertion depends on: reword it in the SDK and this half fails instead of rotting.
    assert.ok(logs.includes('responseMode: \'json\''), logs)
  })

  await t.test('invalid arguments and unknown months are rejected without exposing writes', async () => {
    for (const [name, args] of [['get_month_details', { monthId: -1 }], ['list_months', { itemsPerPage: 10000 }], ['create_month', {}]]) {
      const result = await (await rpc(token, name, args)).json()
      assert.ok(result.error || result.result?.isError)
    }
    assert.equal((await (await rpc(token, 'get_month_details', { monthId: 999999 })).json()).result.isError, true)
    for (const method of ['GET', 'DELETE']) {
      const response = await api('/mcp', { method, headers: { Authorization: `Bearer ${token}` } })
      assert.equal(response.status, 405)
      assert.equal(response.headers.get('allow'), 'POST')
    }
    const malformed = await fetch(`${base}/mcp`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{'
    })
    assert.equal(malformed.status, 400)
    assert.equal((await malformed.json()).error.code, -32700)
    const oversized = await rpc(token, 'get_latest_month_summary', { text: 'x'.repeat(70000) })
    assert.equal(oversized.status, 413)
  })

  await t.test('2025 clients can still initialize and call tools without sessions', async () => {
    const headers = { Authorization: `Bearer ${token}`, Accept: 'application/json, text/event-stream' }
    const response = await api('/mcp', {
      method: 'POST', headers,
      body: { jsonrpc: '2.0', id: 1, method: 'initialize', params: {
        protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'legacy-test', version: '1.0.0' }
      } }
    })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('mcp-session-id'), null)
    assert.match(await response.text(), /2025-11-25/)
    const listed = await api('/mcp', {
      method: 'POST', headers: { ...headers, 'MCP-Protocol-Version': '2025-11-25' },
      body: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }
    })
    assert.equal(listed.status, 200)
    assert.match(await listed.text(), /get_latest_month_summary/)
  })

  await t.test('reset immediately revokes the old token; disabling blocks the new token', async () => {
    const previous = token
    token = (await json('/api/settings/mcp/token', { method: 'POST' })).token
    assert.notEqual(token, previous)
    assert.equal((await rpc(previous)).status, 401)
    assert.equal((await rpc(token)).status, 200)
    await json('/api/settings/mcp', { method: 'PUT', body: { enabled: false } })
    assert.equal((await rpc(token)).status, 404)
    token = (await json('/api/settings/mcp/token', { method: 'POST' })).token
    assert.equal((await rpc(token)).status, 404)
    await json('/api/settings/mcp', { method: 'PUT', body: { enabled: true } })
    assert.equal((await json('/api/settings/mcp/token')).token, token)
  })

  await t.test('settings and token survive restart; changing AUTH_SECRET requires a new token', async () => {
    await stop()
    await start()
    await login()
    assert.equal((await json('/api/settings/mcp')).enabled, true)
    assert.equal((await json('/api/settings/mcp/token')).token, token)
    assert.equal((await rpc(token)).status, 200)
    await stop()
    await start(randomBytes(32).toString('hex'))
    await login()
    assert.equal((await json('/api/settings/mcp')).tokenReadable, false)
    assert.equal((await rpc(token)).status, 401)
    const replacement = (await json('/api/settings/mcp/token', { method: 'POST' })).token
    assert.equal((await rpc(replacement)).status, 200)
    assert.equal(logs.includes(replacement), false)
  })
})
