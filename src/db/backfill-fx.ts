/**
 * Backfill the exchange rate archive from Nepal Rastra Bank.
 *
 *   npm run backfill:fx            # as far back as the API will give us
 *   npm run backfill:fx 2024-01-01 # from a specific date
 *
 * Today's rate is a commodity — twenty sites have it. A clean, sourced,
 * queryable HISTORY is not, and it is the thing worth owning here. So we take
 * everything NRB will part with on day one rather than starting the clock now.
 *
 * Run this from a machine that can reach nrb.org.np.
 */
import 'dotenv/config'
import { db } from './index'
import { source, fxRate } from './schema'
import { eq, sql } from 'drizzle-orm'
import { fetchNrbPage } from '../lib/nrb'
import { saveFxRows } from './rates'

const DEFAULT_START = '2010-01-01'

async function main() {
  const from = process.argv[2] ?? DEFAULT_START
  const to = new Date().toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    console.error(`Bad start date "${from}" — expected YYYY-MM-DD`)
    process.exit(1)
  }

  const label = 'Nepal Rastra Bank — official published foreign exchange reference rate (forex API v1)'
  let [src] = await db.select().from(source).where(eq(source.label, label)).limit(1)
  if (!src) {
    ;[src] = await db.insert(source).values({
      kind: 'official', label, url: 'https://www.nrb.org.np/forex/',
    }).returning()
  }

  console.log(`Backfilling ${from} → ${to} from Nepal Rastra Bank…`)

  let page = 1
  let pages = 1
  let saved = 0
  let emptyPages = 0

  do {
    let res
    try {
      res = await fetchNrbPage(from, to, page, 100)
    } catch (e) {
      // One bad page must not throw away everything already written. Retry once,
      // then move on — a gap is recoverable, a crashed 40-minute job is not.
      console.warn(`  page ${page} failed (${e}); retrying once…`)
      await sleep(3000)
      try {
        res = await fetchNrbPage(from, to, page, 100)
      } catch (e2) {
        console.warn(`  page ${page} failed again; skipping. ${e2}`)
        page++
        continue
      }
    }

    pages = res.pages
    const n = await saveFxRows(res.rows, src?.id ?? null)
    saved += n
    if (res.rows.length === 0) emptyPages++
    console.log(`  page ${page}/${pages} — ${res.rows.length} rates parsed, ${n} written (${saved} total)`)

    page++
    await sleep(400)          // be a polite guest on a central bank's server
  } while (page <= pages && emptyPages < 3)

  const [stats] = await db.select({
    rows: sql<number>`count(*)::int`,
    currencies: sql<number>`count(distinct ${fxRate.iso3})::int`,
    first: sql<string>`min(${fxRate.date})`,
    last: sql<string>`max(${fxRate.date})`,
  }).from(fxRate)

  console.log(`\n✓ archive now holds ${stats.rows.toLocaleString()} rates across ` +
              `${stats.currencies} currencies, ${stats.first} → ${stats.last}`)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
