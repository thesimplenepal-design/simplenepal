import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set — copy .env.example to .env')

// Neon and most poolers dislike prepared statements; keep this off.
const client = postgres(url, { prepare: false, max: 10 })
export const db = drizzle(client, { schema })
export { schema }
