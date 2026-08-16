import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { priceObservation, priceItem } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { nepalDateKey } from '@/lib/hours'

export const runtime = 'nodejs'

const CONTEXTS = ['airport', 'tourist_area', 'local_area', 'online'] as const

export async function POST(req: Request) {
  if ((await cookies()).get('sn_admin')?.value !== 'ok') {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 })
  }

  let body: unknown
  try { body = await req.json() } catch { return bad('body was not JSON') }
  if (typeof body !== 'object' || body === null) return bad('body was not an object')
  const b = body as Record<string, unknown>

  const itemId = Number(b.itemId)
  if (!Number.isInteger(itemId) || itemId <= 0) return bad('pick an item')
  const [item] = await db.select().from(priceItem).where(eq(priceItem.id, itemId)).limit(1)
  if (!item) return bad('unknown item')

  const amount = Math.round(Number(String(b.amount ?? '').replace(/[, ]/g, '')))
  if (!Number.isFinite(amount) || amount < 0) return bad('that is not a price')
  // Above this is a slipped digit, and one bad row skews a median that somebody
  // is about to quote to a taxi driver.
  if (amount > 2_000_000) return bad(`NPR ${amount.toLocaleString()} looks like a typo`)

  const context = CONTEXTS.includes(b.context as never)
    ? (b.context as (typeof CONTEXTS)[number]) : 'local_area'

  const observedAt = typeof b.observedAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.observedAt)
    ? b.observedAt : nepalDateKey()
  if (observedAt > nepalDateKey()) return bad('that date is in the future')

  await db.insert(priceObservation).values({
    itemId, amount, context, observedAt,
    observedBy: String(b.observedBy ?? 'Sanjog').slice(0, 80),
    placeNote: String(b.placeNote ?? '').slice(0, 120) || null,
    note: String(b.note ?? '').slice(0, 400) || null,
  })

  revalidatePath('/prices')
  return NextResponse.json({ ok: true, item: item.nameEn, amount, context, observedAt })
}

function bad(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 })
}
