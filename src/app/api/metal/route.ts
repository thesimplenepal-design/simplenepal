import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { metalRate, source } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { nepalDateKey } from '@/lib/hours'

export const runtime = 'nodejs'

const METALS = ['gold_hallmark', 'gold_tejabi', 'silver'] as const
type Metal = (typeof METALS)[number]

export async function POST(req: Request) {
  if ((await cookies()).get('sn_admin')?.value !== 'ok') {
    return NextResponse.json({ ok: false, error: 'unauthorised' }, { status: 401 })
  }

  let body: unknown
  try { body = await req.json() } catch { return bad('body was not JSON') }
  if (typeof body !== 'object' || body === null) return bad('body was not an object')
  const b = body as Record<string, unknown>

  const date = typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : nepalDateKey()
  // A reading dated in the future would sit at the end of every chart and skew
  // the "latest" tile until real time caught up with the typo.
  if (date > nepalDateKey()) return bad('that date is in the future')

  const rows: { metal: Metal; perTola: number }[] = []
  for (const m of METALS) {
    const raw = b[m]
    if (raw === undefined || raw === null || raw === '') continue
    const n = Math.round(Number(String(raw).replace(/[, ]/g, '')))
    if (!Number.isFinite(n) || n <= 0) return bad(`${m}: "${String(raw)}" is not a price`)
    // A tola of silver is in the low thousands, gold in the low hundreds of
    // thousands. Anything outside this is a slipped digit, and one bad reading
    // rescales every chart on the page.
    if (n > 5_000_000) return bad(`${m}: ${n.toLocaleString()} looks like a typo — too large`)
    rows.push({ metal: m, perTola: n })
  }
  if (rows.length === 0) return bad('no prices given')

  const src = await ensureSource()

  await db.insert(metalRate).values(
    rows.map((r) => ({
      date, metal: r.metal, perTola: r.perTola,
      sourceId: src?.id ?? null,
      enteredBy: 'Sanjog',
      note: String(b.note ?? '').slice(0, 400) || null,
    })),
  ).onConflictDoUpdate({
    target: [metalRate.date, metalRate.metal],
    set: { perTola: sql`excluded.per_tola`, note: sql`excluded.note` },
  })

  revalidatePath('/rates/gold')
  return NextResponse.json({ ok: true, date, saved: rows.length })
}

function bad(error: string) {
  return NextResponse.json({ ok: false, error }, { status: 400 })
}

async function ensureSource() {
  const label =
    'Federation of Nepal Gold and Silver Dealers’ Association (FENEGOSIDA) — published daily rate, ' +
    'read and entered by hand once a week'
  const [existing] = await db.select().from(source).where(eq(source.label, label)).limit(1)
  if (existing) return existing
  const [row] = await db.insert(source).values({
    kind: 'official', label, url: 'https://www.fenegosida.org/',
  }).returning()
  return row
}
