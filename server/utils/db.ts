import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import * as schema from './schema'

let sqlite: Database.Database | undefined
let migrated = false

function databasePath() {
  const configured = process.env.DATABASE_URL || './data/flat-ledger.sqlite'
  return resolve(process.cwd(), configured.replace('file:', ''))
}

function runMigrations(client: Database.Database) {
  if (migrated) {
    return
  }

  client.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      email_verified INTEGER NOT NULL DEFAULT 0,
      image TEXT,
      created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
      updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
    );

    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY NOT NULL,
      expires_at INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
      updated_at INTEGER NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS session_user_id_idx ON session(user_id);

    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY NOT NULL,
      account_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      access_token TEXT,
      refresh_token TEXT,
      id_token TEXT,
      access_token_expires_at INTEGER,
      refresh_token_expires_at INTEGER,
      scope TEXT,
      password TEXT,
      created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS account_user_id_idx ON account(user_id);

    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY NOT NULL,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)),
      updated_at INTEGER NOT NULL DEFAULT (cast(unixepoch('subsecond') * 1000 as integer))
    );

    CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);

    CREATE TABLE IF NOT EXISTS months (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      year INTEGER NOT NULL,
      month INTEGER NOT NULL,
      is_closed INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payment_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL DEFAULT 'fixed',
      is_metered INTEGER NOT NULL DEFAULT 0,
      is_required INTEGER NOT NULL DEFAULT 1,
      default_amount REAL,
      unit_price REAL,
      unit TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month_id INTEGER NOT NULL REFERENCES months(id) ON DELETE CASCADE,
      payment_type_id INTEGER REFERENCES payment_types(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      calculated_amount REAL,
      is_manual_amount INTEGER NOT NULL DEFAULT 0,
      is_required INTEGER NOT NULL DEFAULT 1,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS payments_month_id_idx ON payments(month_id);
    CREATE INDEX IF NOT EXISTS payments_type_id_idx ON payments(payment_type_id);

    CREATE TABLE IF NOT EXISTS meter_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_id INTEGER NOT NULL UNIQUE REFERENCES payments(id) ON DELETE CASCADE,
      previous_value REAL NOT NULL,
      current_value REAL NOT NULL,
      usage REAL NOT NULL,
      unit_price REAL NOT NULL,
      unit TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS meter_readings_payment_id_idx ON meter_readings(payment_id);
  `)

  migrated = true
}

export function useDb() {
  if (!sqlite) {
    const path = databasePath()
    mkdirSync(dirname(path), { recursive: true })
    sqlite = new Database(path)
    runMigrations(sqlite)
  }

  return drizzle(sqlite, { schema })
}

export function useSqlite() {
  if (!sqlite) {
    useDb()
  }

  return sqlite!
}
