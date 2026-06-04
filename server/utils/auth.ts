import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'
import { schema } from './schema'

export const auth = betterAuth({
  baseURL: process.env.AUTH_URL || 'http://localhost:3000',
  secret: process.env.AUTH_SECRET || 'dev-only-change-me',
  database: drizzleAdapter(useDb(), {
    provider: 'sqlite',
    schema
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: false,
    minPasswordLength: 8
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60
    }
  }
})
