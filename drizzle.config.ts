import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  out: './drizzle',
  schema: './server/utils/schema.ts',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.NUXT_DATABASE_URL || './data/flat-ledger.sqlite'
  }
})
