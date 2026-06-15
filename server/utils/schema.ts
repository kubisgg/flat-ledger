import { relations, sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false).notNull(),
  image: text('image'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).$onUpdate(() => new Date()).notNull()
})

export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  token: text('token').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$onUpdate(() => new Date()).notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' })
}, table => [index('session_user_id_idx').on(table.userId)])

export const account = sqliteTable('account', {
  id: text('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp_ms' }),
  refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp_ms' }),
  scope: text('scope'),
  password: text('password'),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).$onUpdate(() => new Date()).notNull()
}, table => [index('account_user_id_idx').on(table.userId)])

export const verification = sqliteTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`).$onUpdate(() => new Date()).notNull()
}, table => [index('verification_identifier_idx').on(table.identifier)])

export const months = sqliteTable('months', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  isClosed: integer('is_closed', { mode: 'boolean' }).notNull().default(false),
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const paymentTypes = sqliteTable('payment_types', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  kind: text('kind', { enum: ['fixed', 'metered', 'variable'] }).notNull().default('fixed'),
  isMetered: integer('is_metered', { mode: 'boolean' }).notNull().default(false),
  isRequired: integer('is_required', { mode: 'boolean' }).notNull().default(true),
  defaultActive: integer('default_active', { mode: 'boolean' }).notNull().default(false),
  defaultAmount: real('default_amount'),
  unitPrice: real('unit_price'),
  unit: text('unit'),
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
})

export const payments = sqliteTable('payments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  monthId: integer('month_id').notNull().references(() => months.id, { onDelete: 'cascade' }),
  paymentTypeId: integer('payment_type_id').references(() => paymentTypes.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  amount: real('amount').notNull().default(0),
  calculatedAmount: real('calculated_amount'),
  isManualAmount: integer('is_manual_amount', { mode: 'boolean' }).notNull().default(false),
  isRequired: integer('is_required', { mode: 'boolean' }).notNull().default(true),
  note: text('note'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [
  index('payments_month_id_idx').on(table.monthId),
  index('payments_type_id_idx').on(table.paymentTypeId)
])

export const meterReadings = sqliteTable('meter_readings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  paymentId: integer('payment_id').notNull().references(() => payments.id, { onDelete: 'cascade' }),
  previousValue: real('previous_value').notNull(),
  currentValue: real('current_value').notNull(),
  usage: real('usage').notNull(),
  unitPrice: real('unit_price').notNull(),
  unit: text('unit'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`)
}, table => [index('meter_readings_payment_id_idx').on(table.paymentId)])

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(session),
  accounts: many(account)
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  month: one(months, { fields: [payments.monthId], references: [months.id] }),
  paymentType: one(paymentTypes, { fields: [payments.paymentTypeId], references: [paymentTypes.id] }),
  meterReading: one(meterReadings, { fields: [payments.id], references: [meterReadings.paymentId] })
}))

export const schema = {
  users,
  user: users,
  session,
  account,
  verification,
  months,
  paymentTypes,
  appSettings,
  payments,
  meterReadings
}
