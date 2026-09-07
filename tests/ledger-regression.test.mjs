import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import Database from 'better-sqlite3'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { roundToWholePln, sumTransferCharges } from '../shared/utils/transfer.ts'

test('transfer amounts retain cents until the final PLN rounding', () => {
  const charges = Object.freeze([
    Object.freeze({ amount: 10.49, isRequired: true }),
    Object.freeze({ amount: 20.49, isRequired: true }),
    Object.freeze({ amount: 900, isRequired: false })
  ])
  assert.ok(Math.abs(sumTransferCharges(charges) - 30.98) < 1e-10)
  assert.equal(roundToWholePln(sumTransferCharges(charges)), 31)
  assert.equal(sumTransferCharges([]), 0)
  assert.equal(sumTransferCharges([{ amount: 99, isRequired: false }]), 0)
  for (const [amount, rounded] of [[0, 0], [0.49, 0], [0.5, 1], [10.5, 11], [-1.5, -1], [123456.99, 123457]]) {
    assert.equal(roundToWholePln(amount), rounded)
  }
})

test('ledger HTTP regression checks against an isolated SQLite database', { timeout: 60000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'flat-ledger-regression-'))
  const listener = createServer().listen(0, '127.0.0.1')
  await once(listener, 'listening')
  const port = listener.address().port
  await new Promise(resolve => listener.close(resolve))
  const base = `http://127.0.0.1:${port}`
  const database = join(directory, 'ledger.sqlite')
  let logs = ''
  let cookie = ''
  let db
  const server = spawn(process.execPath, ['.output/server/index.mjs'], {
    env: {
      ...process.env, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
      NITRO_HOST: '127.0.0.1', NITRO_PORT: String(port), DATABASE_URL: database,
      AUTH_URL: base, AUTH_SECRET: randomBytes(32).toString('hex'), ADMIN_EMAIL: '', ADMIN_PASSWORD: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  server.stdout.on('data', data => logs += data)
  server.stderr.on('data', data => logs += data)
  t.after(async () => {
    db?.close()
    if (server.exitCode === null) {
      const stopped = once(server, 'exit')
      server.kill('SIGTERM')
      await stopped
    }
    await rm(directory, { recursive: true, force: true })
  })
  async function api(path, options = {}) {
    return fetch(`${base}${path}`, { ...options, headers: { cookie, ...options.headers } })
  }
  async function json(path, options) {
    const response = await api(path, options)
    assert.equal(response.status, 200, `${path}: ${await response.clone().text()}`)
    return response.json()
  }
  for (let attempt = 0; ; attempt++) {
    if (server.exitCode !== null || attempt === 100) throw new Error(`Server failed to start: ${logs}`)
    try {
      if ((await api('/api/session')).ok) break
    } catch { /* Startup has not opened the listener yet. */ }
    await delay(100)
  }
  const signup = await api('/api/auth/sign-up/email', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Origin': base },
    body: JSON.stringify({ email: 'ledger-test@example.local', password: randomBytes(24).toString('hex'), name: 'Ledger test' })
  })
  assert.equal(signup.status, 200, await signup.clone().text())
  cookie = signup.headers.getSetCookie().map(value => value.split(';')[0]).join('; ')
  assert.ok(cookie)
  db = new Database(database)
  db.pragma('foreign_keys = ON')

  await t.test('empty ledger and missing month keep their documented API shapes', async () => {
    assert.deepEqual(await json('/api/dashboard'), { month: null, total: 0, paid: false, payments: [] })
    assert.deepEqual(await json('/api/months'), { data: [], total: 0 })
    assert.deepEqual(await json('/api/dashboard/meter-history'), [])
    assert.equal((await api('/api/months/999999')).status, 404)
    assert.equal((await fetch(`${base}/api/dashboard`)).status, 401)
  })

  const insertMonth = db.prepare('INSERT INTO months (name, year, month, is_closed) VALUES (?, ?, ?, ?)')
  const ids = new Map()
  // Deliberately insert newest first. ID ordering must never determine calendar order.
  for (let offset = 14; offset >= 0; offset--) {
    const year = 2025 + Math.floor(offset / 12)
    const month = offset % 12 + 1
    ids.set(offset, Number(insertMonth.run(`${year}-${month}`, year, month, offset % 2).lastInsertRowid))
  }
  const latestId = ids.get(14)
  const insertPayment = db.prepare('INSERT INTO payments (month_id, payment_type_id, name, amount, is_required, calculated_amount, is_manual_amount) VALUES (?, ?, ?, ?, ?, ?, ?)')
  insertPayment.run(latestId, null, 'Required A', 10.49, 1, null, 1)
  insertPayment.run(latestId, null, 'Required B', 20.49, 1, null, 1)
  insertPayment.run(latestId, null, 'Excluded', 900, 0, null, 1)
  insertPayment.run(ids.get(0), null, 'Old charge', 1234, 1, null, 1)

  await t.test('dashboard selects by year/month and includes only required stored amounts', async () => {
    const result = await json('/api/dashboard')
    assert.equal(result.month.id, latestId)
    assert.ok(Math.abs(result.total - 30.98) < 1e-10)
    assert.equal(result.payments.length, 3)
    assert.equal(result.openMonths, 8)
    assert.equal(result.paid, false)
    db.prepare('UPDATE months SET is_closed = 1 WHERE id = ?').run(latestId)
    const closed = await json('/api/dashboard')
    assert.equal(closed.paid, true)
    assert.equal(closed.total, result.total)
    assert.equal(closed.openMonths, 7)
    db.prepare('UPDATE months SET is_closed = 0 WHERE id = ?').run(latestId)
  })

  await t.test('pagination preserves calendar ordering across years without overlaps', async () => {
    const pages = await Promise.all([1, 2, 3, 4].map(page => json(`/api/months?page=${page}&itemsPerPage=5`)))
    assert.ok(pages.every(page => page.total === 15))
    assert.deepEqual(pages.map(page => page.data.length), [5, 5, 5, 0])
    assert.deepEqual(pages.flatMap(page => page.data.map(month => month.id)), Array.from({ length: 15 }, (_, i) => ids.get(14 - i)))
    assert.equal((await json('/api/months')).data.length, 10)
    assert.deepEqual((await json('/api/months?page=0&itemsPerPage=5')).data, pages[0].data)
    assert.equal((await json('/api/months?itemsPerPage=9999')).data.length, 15)
  })

  const insertType = db.prepare('INSERT INTO payment_types (name, kind, is_metered, unit) VALUES (?, ?, ?, ?)')
  const water = Number(insertType.run('Water', 'metered', 1, 'm3').lastInsertRowid)
  const electricity = Number(insertType.run('Electricity', 'metered', 1, 'kWh').lastInsertRowid)
  const single = Number(insertType.run('Single reading', 'metered', 1, 'm3').lastInsertRowid)
  const excluded = Number(insertType.run('Non-metered', 'fixed', 0, 'unit').lastInsertRowid)
  const insertReading = db.prepare('INSERT INTO meter_readings (payment_id, previous_value, current_value, usage, unit_price, unit) VALUES (?, ?, ?, ?, ?, ?)')
  function reading(type, offset, usage, unit = 'm3') {
    const paymentId = Number(insertPayment.run(ids.get(offset), type, 'Meter payment', 8.25, 0, 12.75, 1).lastInsertRowid)
    insertReading.run(paymentId, 100, 100 + usage, usage, 2.5, unit)
    return paymentId
  }
  for (let offset = 14; offset >= 0; offset--) reading(water, offset, offset + 1)
  reading(electricity, 13, 0, 'kWh')
  reading(electricity, 14, 2.5, 'kWh')
  const singlePayment = reading(single, 14, 7)
  reading(excluded, 14, 100)

  await t.test('details retain manual amounts, calculated amounts, meter snapshots and nullable joins', async () => {
    const details = await json(`/api/months/${latestId}`)
    const plain = details.payments.find(payment => payment.name === 'Required A')
    assert.equal(plain.type, null)
    assert.equal(plain.meter, null)
    const metered = details.payments.find(payment => payment.id === singlePayment)
    assert.equal(metered.amount, 8.25)
    assert.equal(metered.calculatedAmount, 12.75)
    assert.equal(metered.isManualAmount, true)
    assert.equal(metered.isRequired, false)
    assert.equal(metered.type.id, single)
    assert.equal(metered.meter.previousValue, 100)
    assert.equal(metered.meter.currentValue, 107)
    assert.equal(metered.meter.usage, 7)
    assert.equal(metered.meter.unitPrice, 2.5)
    assert.ok(details.payments.every(payment => payment.monthId === latestId))
    assert.ok(Math.abs((await json('/api/dashboard')).total - 30.98) < 1e-10)
  })

  await t.test('history retains the latest 12 readings in chronological order and computes percentage change', async () => {
    const history = await json('/api/dashboard/meter-history')
    assert.deepEqual(history.map(meter => meter.id).sort(), [water, electricity, single].sort())
    const meter = history.find(meter => meter.id === water)
    assert.equal(meter.currentUsage, 15)
    assert.equal(meter.previousUsage, 14)
    assert.deepEqual(meter.change, { text: '+7%', sign: 1 })
    assert.deepEqual(meter.history, Array.from({ length: 12 }, (_, i) => {
      const offset = i + 3
      const month = offset % 12 + 1
      const year = 2025 + Math.floor(offset / 12)
      return { month, year, usage: offset + 1, label: `${String(month).padStart(2, '0')}.${year}` }
    }))
  })

  await t.test('zero baseline uses an absolute delta; a lone reading has no comparison', async () => {
    const history = await json('/api/dashboard/meter-history')
    const power = history.find(meter => meter.id === electricity)
    assert.equal(power.previousUsage, 0)
    assert.deepEqual(power.change, { text: '+2.5 kWh', sign: 1 })
    const lone = history.find(meter => meter.id === single)
    assert.equal(lone.previousUsage, null)
    assert.equal(lone.change, null)
    assert.equal(lone.history.length, 1)
  })

  await t.test('history reflects decreasing and unchanged usage after reading updates', async () => {
    const currentWater = db.prepare('SELECT id FROM payments WHERE month_id = ? AND payment_type_id = ?').get(latestId, water)
    db.prepare('UPDATE meter_readings SET usage = 7 WHERE payment_id = ?').run(currentWater.id)
    let meter = (await json('/api/dashboard/meter-history')).find(meter => meter.id === water)
    assert.deepEqual(meter.change, { text: '-50%', sign: -1 })
    db.prepare('UPDATE meter_readings SET usage = 14 WHERE payment_id = ?').run(currentWater.id)
    meter = (await json('/api/dashboard/meter-history')).find(meter => meter.id === water)
    assert.deepEqual(meter.change, { text: '0%', sign: 0 })
  })

  await t.test('MCP maps populated meter history and manual charges to explicit transfer fields', async () => {
    await json('/api/settings/mcp', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', 'Origin': base },
      body: JSON.stringify({ enabled: true })
    })
    const { token } = await json('/api/settings/mcp/token')
    const client = new Client({ name: 'ledger-regression', version: '1.0.0' })
    const transport = new StreamableHTTPClientTransport(new URL(`${base}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } }
    })
    try {
      await client.connect(transport)
      async function call(name, args = {}) {
        const result = await client.callTool({ name, arguments: args })
        assert.equal(result.isError, undefined, JSON.stringify(result.content))
        assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent)
        return result.structuredContent
      }
      const { meters } = await call('get_meter_history')
      assert.equal(meters.length, 3)
      assert.deepEqual(meters.find(meter => meter.id === electricity), {
        id: electricity, name: 'Electricity', unit: 'kWh', currentUsage: 2.5,
        previousUsage: 0, usageDelta: 2.5, usageChangePercent: null,
        history: [{ year: 2026, month: 2, usage: 0 }, { year: 2026, month: 3, usage: 2.5 }]
      })
      assert.deepEqual(meters.find(meter => meter.id === single), {
        id: single, name: 'Single reading', unit: 'm3', currentUsage: 7,
        previousUsage: null, usageDelta: null, usageChangePercent: null,
        history: [{ year: 2026, month: 3, usage: 7 }]
      })
      const waterMeter = meters.find(meter => meter.id === water)
      assert.equal(waterMeter.history.length, 12)
      assert.equal(waterMeter.usageDelta, 0)
      assert.equal(waterMeter.usageChangePercent, 0)
      db.prepare('UPDATE meter_readings SET usage = 15 WHERE payment_id IN (SELECT id FROM payments WHERE month_id = ? AND payment_type_id = ?)').run(latestId, water)
      const changedWater = (await call('get_meter_history')).meters.find(meter => meter.id === water)
      assert.equal(changedWater.usageDelta, 1)
      assert.equal(changedWater.usageChangePercent, 7.14)
      const details = await call('get_month_details', { monthId: latestId })
      assert.ok(Math.abs(details.transferAmount - 30.98) < 1e-10)
      assert.equal(details.roundedTransferAmount, 31)
      assert.equal(details.month.transferSent, false)
      assert.deepEqual(details.charges.find(charge => charge.id === singlePayment), {
        id: singlePayment, name: 'Meter payment', amount: 8.25, includedInTransfer: false,
        note: null, calculatedAmount: 12.75, isManualAmount: true,
        chargeType: { id: single, name: 'Single reading', kind: 'metered' },
        meterReading: { previousValue: 100, currentValue: 107, usage: 7, unitPrice: 2.5, unit: 'm3' }
      })
      const manual = details.charges.find(charge => charge.name === 'Required A')
      assert.equal(manual.chargeType, null)
      assert.equal(manual.meterReading, null)
      assert.equal(manual.calculatedAmount, null)
      assert.equal(manual.isManualAmount, true)
      const summary = await call('get_latest_month_summary')
      assert.equal(summary.roundedTransferAmount, 31)
      assert.equal(summary.unsentMonthCount, 8)
      assert.equal(summary.transferSent, false)
      const page = await call('list_months', { page: 2, itemsPerPage: 5 })
      assert.equal(page.totalMonthCount, 15)
      assert.deepEqual(page.months.map(month => month.id), [9, 8, 7, 6, 5].map(offset => ids.get(offset)))
    } finally {
      await client.close()
    }
  })
})
