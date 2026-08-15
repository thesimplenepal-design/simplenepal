import { NextResponse } from 'next/server'
import { db } from '@/db'
import { source } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { fetchNrbPage } from '@/lib/nrb'
import { saveFxRows } from '@/db/rates'
import { nepalDateKey } from '@/lib/hours'
import { revalidatePath } from 'next/cache'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

/**
 * Daily pull of Nepal Rastra Bank's published exchange rates.
 *
 * Vercel's Hobby plan runs cron jobs once a day, within an hour of the
 * scheduled time — which suits a source that publishes once a day anyway.
 *
 * It requests a WINDOW of the last several days, not just today. NRB publishes
 * on its own schedule and doesn't publish at all on some days; asking for a
 * window means one missed or late run heals itself on the next, rather than
 * leaving a permanent hole in the history.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
    }
  }

  const to = nepalDateKey()
  const from = new Date(Date.parse(`${to}T00:00:00Z`) - 7 * 86_400_000).toISOString().slice(0, 10)

  try {
    const src = await ensureSource()
    let saved = 0
    let page = 1
    let pages = 1

    do {
      const res = await fetchNrbPage(from, to, page, 100)
      saved += await saveFxRows(res.rows, src?.id ?? null)
      pages = res.pages
      page++
    } while (page <= pages && page <= 5)   // a week can't need more than 5 pages

    revalidatePath('/rates')

    return NextResponse.json({ ok: true, from, to, saved })
  } catch (e) {
    // Return 200 with ok:false. A 500 here would make the page's own staleness
    // banner the second signal rather than the first, and that banner is what
    // the reader actually sees.
    console.error('[cron/rates] failed:', e)
    return NextResponse.json({ ok: false, from, to, error: String(e) })
  }
}

async function ensureSource() {
  const label = 'Nepal Rastra Bank — official published foreign exchange reference rate (forex API v1)'
  const [existing] = await db.select().from(source).where(eq(source.label, label)).limit(1)
  if (existing) return existing
  const [row] = await db.insert(source).values({
    kind: 'official', label, url: 'https://www.nrb.org.np/forex/',
  }).returning()
  return row
}
