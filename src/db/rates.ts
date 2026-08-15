import { db } from './index'
import { fxRate, metalRate, source } from './schema'
import { eq, and, desc, gte, sql, inArray } from 'drizzle-orm'
import type { FxRow } from '@/lib/nrb'
import { nepalDateKey } from '@/lib/hours'

/** Insert or update a batch of rates. Re-running a day is safe and idempotent. */
export async function saveFxRows(rows: FxRow[], sourceId: number | null): Promise<number> {
  if (rows.length === 0) return 0
  let saved = 0
  const CHUNK = 400
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK)
    const res = await db.insert(fxRate).values(
      batch.map((r) => ({
        date: r.date, iso3: r.iso3, currencyName: r.currencyName,
        unit: r.unit, buy: r.buy, sell: r.sell, sourceId,
      })),
    ).onConflictDoUpdate({
      target: [fxRate.date, fxRate.iso3],
      // NRB revises rates occasionally; last write for a given day wins.
      set: {
        buy: sql`excluded.buy`, sell: sql`excluded.sell`,
        unit: sql`excluded.unit`, currencyName: sql`excluded.currency_name`,
        fetchedAt: new Date(),
      },
    }).returning({ id: fxRate.id })
    saved += res.length
  }
  return saved
}

export type FxToday = {
  date: string
  rates: { iso3: string; currencyName: string; unit: number; buy: string; sell: string }[]
  sourceLabel: string | null
  sourceUrl: string | null
}

/**
 * The most recent day we hold — which is NOT necessarily today. The caller must
 * compare `date` against today and say so. Silently serving Thursday's rate as
 * if it were current is the one failure mode that would actually cost someone
 * money, so this function refuses to hide it.
 */
export async function latestFx(): Promise<FxToday | null> {
  const [latest] = await db
    .select({ date: fxRate.date }).from(fxRate).orderBy(desc(fxRate.date)).limit(1)
  if (!latest) return null

  const rates = await db
    .select({
      iso3: fxRate.iso3, currencyName: fxRate.currencyName,
      unit: fxRate.unit, buy: fxRate.buy, sell: fxRate.sell,
      sourceLabel: source.label, sourceUrl: source.url,
    })
    .from(fxRate)
    .leftJoin(source, eq(source.id, fxRate.sourceId))
    .where(eq(fxRate.date, latest.date))
    .orderBy(fxRate.iso3)

  return {
    date: latest.date,
    rates,
    sourceLabel: rates[0]?.sourceLabel ?? null,
    sourceUrl: rates[0]?.sourceUrl ?? null,
  }
}

/** Whole days between the newest rate we hold and today in Nepal. */
export function stalenessDays(rateDate: string, now: Date = new Date()): number {
  const a = Date.parse(`${rateDate}T00:00:00Z`)
  const b = Date.parse(`${nepalDateKey(now)}T00:00:00Z`)
  return Math.max(0, Math.round((b - a) / 86_400_000))
}

/** A single currency's history, for the sparkline on the rates page. */
export async function fxHistory(iso3: string, days = 365) {
  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  return db
    .select({ date: fxRate.date, sell: fxRate.sell })
    .from(fxRate)
    .where(and(eq(fxRate.iso3, iso3.toUpperCase()), gte(fxRate.date, from)))
    .orderBy(fxRate.date)
}

export type MetalPoint = { date: string; metal: string; perTola: number }

export async function metalHistory(days = 3650): Promise<MetalPoint[]> {
  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10)
  return db
    .select({ date: metalRate.date, metal: metalRate.metal, perTola: metalRate.perTola })
    .from(metalRate)
    .where(gte(metalRate.date, from))
    .orderBy(metalRate.date)
}

export async function latestMetal() {
  const rows = await db
    .select({
      date: metalRate.date, metal: metalRate.metal, perTola: metalRate.perTola,
      sourceLabel: source.label, sourceUrl: source.url,
    })
    .from(metalRate)
    .leftJoin(source, eq(source.id, metalRate.sourceId))
    .orderBy(desc(metalRate.date))
    .limit(9)
  // Newest reading per metal, in a fixed display order — gold before silver.
  // Ordering by whatever the query happened to return puts silver first some
  // days and hallmark gold first on others, which reads as a broken page.
  const ORDER = ['gold_hallmark', 'gold_tejabi', 'silver']
  const seen = new Set<string>()
  return rows
    .filter((r) => (seen.has(r.metal) ? false : (seen.add(r.metal), true)))
    .sort((a, b) => ORDER.indexOf(a.metal) - ORDER.indexOf(b.metal))
}
