export function toNumber(value: unknown, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function floorMoney(value: number) {
  return Math.floor(value * 100) / 100
}

export function normalizeDate(value: unknown) {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function nowSql() {
  return new Date().toISOString()
}
