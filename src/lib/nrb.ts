/**
 * Nepal Rastra Bank foreign exchange API.
 *
 *   https://www.nrb.org.np/api/forex/v1/rates?from=&to=&per_page=&page=
 *
 * The central bank's own published reference rate — the highest-confidence
 * source available for this, and free with no authentication.
 *
 * The parser below is deliberately paranoid. This is the first thing in the
 * codebase that depends on a third party's live output, and third parties
 * change response shapes without telling anyone. Every field is checked; a
 * malformed row is skipped rather than poisoning the table, and a malformed
 * *response* returns an empty list rather than throwing — a cron job that dies
 * silently is worse than one that reports zero rows, because zero rows is
 * visible on the page as "we could not refresh today".
 */

export const NRB_BASE = 'https://www.nrb.org.np/api/forex/v1/rates'

export type FxRow = {
  date: string          // 'YYYY-MM-DD', the date the rate applies to
  iso3: string
  currencyName: string
  unit: number
  buy: string           // kept as strings: money must not touch a float
  sell: string
}

export type NrbPage = {
  rows: FxRow[]
  page: number
  pages: number
  total: number
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

/** Accepts a number or a numeric string; rejects anything else, including NaN. */
function money(v: unknown): string | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v.toFixed(4) : null
  if (typeof v === 'string') {
    const t = v.trim()
    if (!/^-?\d+(\.\d+)?$/.test(t)) return null
    const n = Number(t)
    return Number.isFinite(n) ? n.toFixed(4) : null
  }
  return null
}

function isoDate(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(v.trim())
  if (!m) return null
  const d = new Date(`${m[1]}T00:00:00Z`)
  return Number.isNaN(d.getTime()) ? null : m[1]
}

export function parseNrb(json: unknown): NrbPage {
  const empty: NrbPage = { rows: [], page: 1, pages: 1, total: 0 }
  if (!isObj(json)) return empty

  const data = isObj(json.data) ? json.data : null
  const payload = data && Array.isArray(data.payload) ? data.payload : null
  if (!payload) return empty

  const rows: FxRow[] = []
  for (const day of payload) {
    if (!isObj(day)) continue
    const date = isoDate(day.date)
    if (!date) continue
    const rates = Array.isArray(day.rates) ? day.rates : []

    for (const r of rates) {
      if (!isObj(r)) continue
      const cur = isObj(r.currency) ? r.currency : null
      if (!cur) continue

      const iso3 = typeof cur.ISO3 === 'string' ? cur.ISO3.trim().toUpperCase() : null
      const name = typeof cur.name === 'string' ? cur.name.trim() : null
      if (!iso3 || !/^[A-Z]{3}$/.test(iso3) || !name) continue

      // NRB quotes JPY and KRW per 100 units. Defaulting to 1 would inflate a
      // yen rate a hundredfold, so a missing or nonsense unit is a skip.
      const rawUnit = typeof cur.unit === 'number' ? cur.unit : Number(cur.unit)
      const unit = Number.isFinite(rawUnit) && rawUnit > 0 ? Math.round(rawUnit) : null
      if (!unit) continue

      const buy = money(r.buy)
      const sell = money(r.sell)
      if (!buy || !sell) continue

      rows.push({ date, iso3, currencyName: name, unit, buy, sell })
    }
  }

  const pg = isObj(json.pagination) ? json.pagination : {}
  const num = (v: unknown, fallback: number) =>
    Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : fallback

  return { rows, page: num(pg.page, 1), pages: num(pg.pages, 1), total: num(pg.total, rows.length) }
}

export function nrbUrl(from: string, to: string, page = 1, perPage = 100): string {
  const u = new URL(NRB_BASE)
  u.searchParams.set('from', from)
  u.searchParams.set('to', to)
  u.searchParams.set('page', String(page))
  u.searchParams.set('per_page', String(Math.min(perPage, 100)))   // API caps at 100
  return u.toString()
}

/** One page, with a timeout. A hung fetch would hold a serverless function open. */
export async function fetchNrbPage(
  from: string, to: string, page = 1, perPage = 100, timeoutMs = 20_000,
): Promise<NrbPage> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(nrbUrl(from, to, page, perPage), {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', 'User-Agent': 'SimpleNepal/1.0 (+https://simplenepal.com)' },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`NRB responded ${res.status}`)
    return parseNrb(await res.json())
  } finally {
    clearTimeout(timer)
  }
}
