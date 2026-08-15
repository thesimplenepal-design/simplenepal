/**
 * Parser tests for the Nepal Rastra Bank forex API.
 *
 *   npx tsx src/lib/nrb.test.ts
 *
 * The first block is the LIVE response, copied verbatim from a real call to
 * nrb.org.np. The published documentation says the currency code field is
 * `ISO3`; the live API returns `iso3`. That single difference silently produced
 * zero rows on the first backfill, so both spellings are now tested and both
 * must keep working.
 */
import { parseNrb } from './nrb'

let fail = 0
const ok = (label: string, cond: boolean) => {
  if (!cond) { fail++; console.log('FAIL', label) } else console.log('ok  ', label)
}

// ── the real thing ───────────────────────────────────────────────────
const live = {
  status: { code: 200 },
  errors: { validation: null },
  params: {
    date: null, from: '2026-08-05', to: '2026-08-15',
    post_type: null, per_page: '3', page: '1', slug: null, q: null,
  },
  data: {
    payload: [{
      date: '2026-08-05',
      published_on: '2026-08-05 00:00:16',
      modified_on: '2026-08-04 15:55:22',
      rates: [
        { currency: { iso3: 'INR', name: 'Indian Rupee', unit: 100 }, buy: '160.00', sell: '160.15' },
        { currency: { iso3: 'USD', name: 'U.S. Dollar', unit: 1 }, buy: '152.31', sell: '152.91' },
        { currency: { iso3: 'EUR', name: 'European Euro', unit: 1 }, buy: '175.31', sell: '176.00' },
        { currency: { iso3: 'GBP', name: 'UK Pound Sterling', unit: 1 }, buy: '204.74', sell: '205.55' },
        { currency: { iso3: 'CHF', name: 'Swiss Franc', unit: 1 }, buy: '188.06', sell: '188.80' },
        { currency: { iso3: 'AUD', name: 'Australian Dollar', unit: 1 }, buy: '107.05', sell: '107.47' },
      ],
    }],
  },
  pagination: {
    page: 1, pages: 4, per_page: 3, total: 12,
    links: { prev: null, next: 'https://www.nrb.org.np/api/forex/v1/rates?page=2' },
  },
}

const p = parseNrb(live)
ok(`live payload parses: ${p.rows.length} rows (expect 6)`, p.rows.length === 6)
ok('pagination read from live shape', p.page === 1 && p.pages === 4 && p.total === 12)

const inr = p.rows.find((r) => r.iso3 === 'INR')
const usd = p.rows.find((r) => r.iso3 === 'USD')
ok('INR present', !!inr)
ok(`INR quoted per 100, not defaulted to 1 (got ${inr?.unit})`, inr?.unit === 100)
ok(`INR buy 160.00 → ${inr?.buy}`, inr?.buy === '160.0000')
ok(`USD sell 152.91 → ${usd?.sell}`, usd?.sell === '152.9100')
ok('currency name carried', usd?.currencyName === 'U.S. Dollar')
ok('date applied to every row', p.rows.every((r) => r.date === '2026-08-05'))

// ── the documented shape must not regress ────────────────────────────
const documented = {
  data: { payload: [{ date: '2026-08-14', rates: [
    { currency: { unit: 1, name: 'U.S. Dollar', ISO3: 'USD' }, buy: '141.25', sell: 141.85 },
  ] }] },
  pagination: { page: 1, pages: 1, total: 1 },
}
ok('documented ISO3 spelling still parses', parseNrb(documented).rows.length === 1)

const mixedCase = { data: { payload: [{ date: '2026-08-14', rates: [
  { currency: { unit: 1, name: 'A', iso3: 'USD' }, buy: '1', sell: '2' },
  { currency: { unit: 1, name: 'B', ISO3: 'EUR' }, buy: '3', sell: '4' },
  { currency: { unit: 1, name: 'C', Iso3: 'GBP' }, buy: '5', sell: '6' },
] }] } }
ok('all three casings parse together', parseNrb(mixedCase).rows.length === 3)

// ── the paranoia must survive the change ─────────────────────────────
const malformed: [string, unknown][] = [
  ['null', null],
  ['empty object', {}],
  ['HTML error page', '<html>502 Bad Gateway</html>'],
  ['payload not an array', { data: { payload: 1 } }],
  ['missing data key', { status: { code: 500 } }],
  ['day is not an object', { data: { payload: [42] } }],
  ['no date anywhere', { data: { payload: [{ rates: [] }] } }],
]
for (const [label, input] of malformed) {
  let n = -1
  try { n = parseNrb(input).rows.length } catch { n = -99 }
  ok(`${label} → 0 rows, no throw`, n === 0)
}

const badRows = { data: { payload: [{ date: '2026-08-05', rates: [
  { currency: { iso3: 'USD', name: 'X', unit: 0 }, buy: '1', sell: '2' },      // unit 0
  { currency: { iso3: 'EUR', name: 'Y', unit: 1 }, buy: 'N/A', sell: '2' },    // price text
  { currency: { iso3: 'BADCODE', name: 'Z', unit: 1 }, buy: '1', sell: '2' },  // bad iso
  { currency: { iso3: 'GBP', name: 'Good', unit: 1 }, buy: '1', sell: '2' },   // fine
] }] } }
ok('bad rows dropped, good row kept', parseNrb(badRows).rows.length === 1)

console.log(fail === 0 ? '\nALL PASS' : `\n${fail} FAILURES`)
if (fail > 0) process.exit(1)
