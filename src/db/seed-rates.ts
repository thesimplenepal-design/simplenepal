/**
 * Development fixture ONLY — synthetic rates so the charts and pages can be
 * built and reviewed before the real backfill runs.
 *
 *   npm run seed:rates
 *
 * Every row it writes is attributed to a source labelled "SYNTHETIC" and is
 * refused outright unless SEED_SYNTHETIC=1 is set. Fake numbers reaching
 * production would be far worse than an empty page on a site whose entire
 * proposition is that its facts are sourced.
 *
 * Real data comes from `npm run backfill:fx` (Nepal Rastra Bank) and the weekly
 * reading at /rates/entry.
 */
import 'dotenv/config'
import { db } from './index'
import { source, fxRate, metalRate } from './schema'
import { eq } from 'drizzle-orm'
import { saveFxRows } from './rates'
import type { FxRow } from '../lib/nrb'

const LABEL = 'SYNTHETIC development fixture — NOT a real rate, delete before production'

async function main() {
  if (process.env.SEED_SYNTHETIC !== '1') {
    console.error(
      'Refusing to write synthetic rates.\n' +
      'This script exists only to develop the charts. If you really want it:\n' +
      '  SEED_SYNTHETIC=1 npm run seed:rates\n' +
      'For real data use:  npm run backfill:fx',
    )
    process.exit(1)
  }

  let [src] = await db.select().from(source).where(eq(source.label, LABEL)).limit(1)
  if (!src) {
    ;[src] = await db.insert(source).values({ kind: 'inference', label: LABEL }).returning()
  }

  const today = new Date()
  const CURRENCIES: [string, string, number, number][] = [
    ['USD', 'U.S. Dollar', 1, 141.2], ['EUR', 'Euro', 1, 152.4], ['GBP', 'Pound Sterling', 1, 178.9],
    ['INR', 'Indian Rupee', 100, 160.15], ['AED', 'UAE Dirham', 1, 38.45],
    ['QAR', 'Qatari Riyal', 1, 38.8], ['SAR', 'Saudi Riyal', 1, 37.65],
    ['MYR', 'Malaysian Ringgit', 1, 31.6], ['KWD', 'Kuwaiti Dinar', 1, 460.2],
    ['AUD', 'Australian Dollar', 1, 92.3], ['JPY', 'Japanese Yen', 100, 95.4],
    ['CNY', 'Chinese Yuan', 1, 19.6],
  ]

  const rows: FxRow[] = []
  for (let d = 400; d >= 0; d--) {
    const date = new Date(today.getTime() - d * 86_400_000).toISOString().slice(0, 10)
    for (const [iso3, name, unit, base] of CURRENCIES) {
      // A slow drift plus a wobble — enough shape to tell whether a chart is
      // scaling and resampling correctly.
      const drift = 1 + (400 - d) * 0.00012
      const wobble = 1 + Math.sin((400 - d) / 11) * 0.004 + Math.sin((400 - d) / 3.3) * 0.0015
      const mid = base * drift * wobble
      rows.push({
        date, iso3, currencyName: name, unit,
        buy: mid.toFixed(4), sell: (mid * 1.004).toFixed(4),
      })
    }
  }
  const saved = await saveFxRows(rows, src?.id ?? null)
  console.log(`✓ ${saved} synthetic fx rows across ${CURRENCIES.length} currencies, 400 days`)

  // Weekly metal readings over two years — the real cadence.
  const metals: [string, number][] = [
    ['gold_hallmark', 158_000], ['gold_tejabi', 157_300], ['silver', 1_960],
  ]
  const mrows = []
  for (let w = 104; w >= 0; w--) {
    const date = new Date(today.getTime() - w * 7 * 86_400_000).toISOString().slice(0, 10)
    for (const [metal, base] of metals) {
      const drift = 1 + (104 - w) * 0.0022
      const wobble = 1 + Math.sin((104 - w) / 7) * 0.02
      mrows.push({
        date, metal: metal as 'gold_hallmark' | 'gold_tejabi' | 'silver',
        perTola: Math.round(base * drift * wobble),
        sourceId: src?.id ?? null, enteredBy: 'synthetic', note: 'SYNTHETIC',
      })
    }
  }
  await db.insert(metalRate).values(mrows).onConflictDoNothing()
  console.log(`✓ ${mrows.length} synthetic metal readings across 105 weeks`)
  console.log('\n⚠ These are NOT real rates. Delete them before going live:')
  console.log("   delete from fx_rate where source_id in (select id from source where label like 'SYNTHETIC%');")
  console.log("   delete from metal_rate where source_id in (select id from source where label like 'SYNTHETIC%');")
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
