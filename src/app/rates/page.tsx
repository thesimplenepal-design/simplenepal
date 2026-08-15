import Link from 'next/link'
import type { Metadata } from 'next'
import { Container } from '@/components/ui'
import { LineChart, resample } from '@/components/chart'
import { latestFx, stalenessDays, fxHistory } from '@/db/rates'
import { adToBs } from '@/lib/bs'
import { Convert } from './convert'

export const revalidate = 1800

export const metadata: Metadata = {
  title: 'Nepal exchange rates today — official NRB rates, converted',
  description:
    'Nepal Rastra Bank’s published foreign exchange reference rates, with a converter ' +
    'and the historical archive. Says which day it is from, every time.',
  alternates: { canonical: '/rates' },
}

/** Money always shows two decimals. An unpadded column reads as ragged and,
 *  worse, makes 168.1 look like a different precision from 168.15. */
function money(v: string | number): string {
  return Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// The currencies most people actually arrive here for: remittance corridors
// first, then the majors.
const PRIORITY = ['USD', 'INR', 'AED', 'QAR', 'SAR', 'MYR', 'KWD', 'GBP', 'EUR', 'AUD', 'JPY', 'CNY']

export default async function RatesPage() {
  let fx: Awaited<ReturnType<typeof latestFx>> = null
  let usd: Awaited<ReturnType<typeof fxHistory>> = []
  try {
    fx = await latestFx()
    if (fx) usd = await fxHistory('USD', 365)
  } catch { /* build without a database */ }

  if (!fx || fx.rates.length === 0) {
    return (
      <Container className="py-10">
        <h1 className="text-[32px] font-bold tracking-tight">Exchange rates</h1>
        <div className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] px-5 py-4 max-w-2xl">
          <p className="text-[14px] text-[var(--color-ink-2)] mb-0">
            We haven&rsquo;t loaded any rates yet. Run the backfill and the daily job will keep it
            current from then on.
          </p>
        </div>
      </Container>
    )
  }

  const stale = stalenessDays(fx.date)
  const bs = adToBs(new Date(`${fx.date}T00:00:00Z`))
  const sorted = [...fx.rates].sort((a, b) => {
    const ia = PRIORITY.indexOf(a.iso3), ib = PRIORITY.indexOf(b.iso3)
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    return a.iso3.localeCompare(b.iso3)
  })

  const usdPoints = resample(
    usd.map((r) => ({ date: r.date, value: Number(r.sell) })).filter((p) => Number.isFinite(p.value)),
    'week',
  )

  return (
    <Container className="py-10">
      <h1 className="text-[32px] sm:text-[38px] font-bold tracking-tight leading-[1.15] max-w-2xl">
        Exchange rates
      </h1>
      <p className="mt-4 text-[17px] text-[var(--color-ink-2)] max-w-2xl leading-relaxed">
        Nepal Rastra Bank&rsquo;s published reference rate — the central bank&rsquo;s own number,
        not an average scraped from somewhere.
      </p>

      {/* The date is the headline, not a footnote. A rate without its date is a
          guess, and this is the one page where a stale number costs real money. */}
      <div className={`mt-6 rounded-xl border border-[var(--color-line)] border-l-[3px] px-4 py-3.5 max-w-2xl ${
        stale === 0 ? 'border-l-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/20'
        : stale <= 3 ? 'border-l-amber-500 bg-amber-50/70 dark:bg-amber-950/20'
        : 'border-l-[var(--color-crimson)] bg-[var(--color-crimson-soft)]'}`}>
        <p className="text-[14.5px] mb-0">
          <strong>
            {stale === 0 ? 'Published today' : stale === 1 ? 'Published yesterday' : `${stale} days old`}
          </strong>
          {' — '}rates for{' '}
          {new Date(`${fx.date}T00:00:00Z`).toLocaleDateString('en-GB',
            { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}
          {bs && <span className="text-[var(--color-ink-3)]"> · {bs.year}/{String(bs.month).padStart(2, '0')}/{String(bs.day).padStart(2, '0')}</span>}
        </p>
        {stale > 1 && (
          <p className="text-[13px] text-[var(--color-ink-2)] mt-1.5 mb-0">
            We could not refresh since then — the bank may not have published, or our daily job
            failed. These are the last rates we hold, not today&rsquo;s. Check with your bank before
            acting on them.
          </p>
        )}
      </div>

      <Convert rates={sorted} />

      <section className="mt-12">
        <h2 className="text-[20px] font-semibold tracking-tight mb-1">All published rates</h2>
        <p className="text-[13px] text-[var(--color-ink-3)] mb-4">
          <strong className="text-[var(--color-ink-2)]">Buy</strong> is what a bank pays you for foreign
          currency. <strong className="text-[var(--color-ink-2)]">Sell</strong> is what it charges you to
          get some.
        </p>
        <div className="overflow-x-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]">
          <table className="w-full text-[14px] border-collapse">
            <thead>
              <tr className="text-[11.5px] uppercase tracking-wider text-[var(--color-ink-3)]">
                <th className="text-left font-medium px-4 py-2.5">Currency</th>
                <th className="text-right font-medium px-4 py-2.5">Unit</th>
                <th className="text-right font-medium px-4 py-2.5">Buy</th>
                <th className="text-right font-medium px-4 py-2.5">Sell</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.iso3} className="border-t border-[var(--color-line)]">
                  <td className="px-4 py-2.5">
                    <span className="font-medium">{r.iso3}</span>
                    <span className="text-[var(--color-ink-3)] text-[13px] ml-2">{r.currencyName}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-[var(--color-ink-3)]">{r.unit}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(r.buy)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{money(r.sell)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {usdPoints.length >= 2 && (
        <section className="mt-12 max-w-2xl">
          <h2 className="text-[20px] font-semibold tracking-tight mb-1">US dollar, past year</h2>
          <p className="text-[13px] text-[var(--color-ink-3)] mb-4">Weekly average of the selling rate.</p>
          <LineChart points={usdPoints} unit="NPR" label="USD selling rate" height={190} />
        </section>
      )}

      {/* The thing every other rates page leaves out. */}
      <section className="mt-12 max-w-2xl rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
        <h2 className="text-[16px] font-semibold tracking-tight mb-2">
          Sending money home? This is not the rate you&rsquo;ll get
        </h2>
        <p className="text-[13.5px] text-[var(--color-ink-2)] leading-relaxed mb-2">
          The figures above are Nepal Rastra Bank&rsquo;s <em>reference</em> rate. A remittance
          company, exchange counter or bank sets its own rate and takes a margin on top of any fee
          it quotes — so the rupees that arrive are usually fewer than this table implies.
        </p>
        <p className="text-[13.5px] text-[var(--color-ink-2)] leading-relaxed mb-0">
          Use this as the benchmark to judge an offer against, not as a prediction of what you will
          receive. A provider quoting close to this rate with a visible fee is usually cheaper than
          one advertising &ldquo;zero fees&rdquo; at a worse rate.
        </p>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/rates/gold"
          className="inline-block no-underline rounded-lg border border-[var(--color-line)]
                     bg-[var(--color-surface)] px-4 py-2.5 text-[14px] hover:border-[var(--color-crimson)]">
          Gold &amp; silver trends →
        </Link>
        <Link href="/date"
          className="inline-block no-underline rounded-lg border border-[var(--color-line)]
                     bg-[var(--color-surface)] px-4 py-2.5 text-[14px] hover:border-[var(--color-crimson)]">
          Nepali date converter →
        </Link>
      </div>

      <p className="text-[12.5px] text-[var(--color-ink-3)] mt-8 max-w-2xl">
        Source:{' '}
        {fx.sourceUrl
          ? <a href={fx.sourceUrl} rel="nofollow noopener" className="underline">{fx.sourceLabel}</a>
          : fx.sourceLabel}
        . We publish this as information, not advice — we are not a bank, a money changer or a
        financial adviser, and we don&rsquo;t exchange currency.
      </p>
    </Container>
  )
}
