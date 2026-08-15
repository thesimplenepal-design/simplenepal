import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

type Db = ReturnType<typeof drizzle<typeof schema>>

let cached: Db | null = null

function getDb(): Db {
  if (cached) return cached
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Locally: copy .env.example to .env. ' +
      'On Vercel: check Settings -> Environment Variables (variables marked ' +
      '"Sensitive" are NOT available during the build).',
    )
  }
  cached = drizzle(postgres(url, { prepare: false, max: 10 }), { schema })
  return cached
}

export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    const real = getDb() as unknown as Record<string | symbol, unknown>
    const value = Reflect.get(real, prop, receiver)
    return typeof value === 'function' ? value.bind(real) : value
  },
})

export { schema }
