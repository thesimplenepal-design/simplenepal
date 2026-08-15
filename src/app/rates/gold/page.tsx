import Link from 'next/link'
import type { Metadata } from 'next'
import { Container, EmptyState } from '@/components/ui'
import { LineChart, resample, type Point } from '@/components/chart'
import { metalHistory, latestMetal } from '@/db/rates'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Gold and silver price trends in Nepal — weekly, monthly and yearly',
  description:
    'How gold and silver prices in Nepal have moved over weeks, months and years. ' +
    'Trend charts built from weekly readings, with the source named.',
  alternates: { canonical: '/rates/gold' },
}

const METAL_LABEL: Record<string, { en: string; ne: string; colour: string }> = {
  gold_hallmark: { en: 'Hallmark gold (chhapawal)', ne: 'छापावाल सुन', colour: '#c8860d' },
  gold_tejabi: { en: 'Tejabi gold', ne: 'तेजाबी सुन', colour: '#a8710a' },
  silver: { en: 'Silver', ne: 'चाँदी', colour: '#7d8590' },
}

const RANGES = [
  { key: 'week' as const, label: 'Weekly', days: 180, blurb: 'Each point is one week' },
  { key: 'month' as const, label: 'Monthly', days: 1095, blurb: 'Each point is a monthly average' },
  { key: 'year' as const, label: 'Yearly', days: 3650, blurb: 'Each point is a yearly average' },
]

export default async function GoldPage({
  searchParams,
}: { searchParams: Promise<{ r?: string }> }) {
  const rKey = (await searchParams).r
  const range = RANGES.find((r) => r.key === rKey) ?? RANGES[0]

  let history: Awaited<ReturnType<typeof metalHistory>> = []
  let latest: Awaited<ReturnType<typeof latestMetal>> = []
  try {
    history = await metalHistory(range.days)
    latest = await latestMetal()
  } catch { /* build without a database */ }

  const byMetal = new Map<string, Point[]>()
  for (const row of history) {
    const arr = byMetal.get(row.metal) ?? []
    arr.push({ date: row.date, value: row.perTola })
    byMetal.set(row.metal, arr)
  }

  return (
    <Container className="py-10">
      <h1 className="text-[32px] sm:text-[38px] font-bold tracking-tight leading-[1.15] max-w-2xl">
        Gold &amp; silver trends
      </h1>
      <p className="mt-4 text-[17px] text-[var(--color-ink-2)] max-w-2xl leading-relaxed">
        How prices have moved over weeks, months and years — in rupees per tola.
      </p>

      {/* Said plainly and up front, because the difference between this page and
          every other gold page in Nepal is the whole point of it. */}
      <div className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3.5 max-w-2xl">
        <p className="text-[13.5px] text-[var(--color-ink-2)] mb-0">
          <strong className="text-[var(--color-ink)]">We don&rsquo;t publish today&rsquo;s rate.</strong>{' '}
          The daily price is set and published by the{' '}
          <a href="https://www.fenegosida.org/" rel="nofollow noopener" className="underline">
            Federation of Nepal Gold and Silver Dealers&rsquo; Association
          </a>{' '}
          — go to them for it. What we keep is the <em>trend</em>: a reading taken every week and
          charted over time, which is the thing that is hard to find anywhere.
        </p>
      </div>

      {latest.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-7">
          {latest.map((m) => (
            <div key={m.metal} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
              <div className="text-[11.5px] uppercase tracking-wider text-[var(--color-ink-3)]">
                {METAL_LABEL[m.metal]?.en ?? m.metal}
              </div>
              <div className="text-[21px] font-semibold tracking-tight mt-1 tabular-nums">
                {m.perTola.toLocaleString()}
              </div>
              <div className="text-[12px] text-[var(--color-ink-3)]">
                NPR per tola · reading of{' '}
                {new Date(`${m.date}T00:00:00Z`).toLocaleDateString('en-GB',
                  { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="inline-flex rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-1 mt-9">
        {RANGES.map((r) => (
          <Link key={r.key} href={`/rates/gold?r=${r.key}`} scroll={false}
            className={`px-4 py-1.5 rounded-md text-[13.5px] font-medium no-underline transition-colors ${
              r.key === range.key
                ? 'bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm text-[var(--color-ink)]'
                : 'text-[var(--color-ink-2)] border border-transparent'}`}>
            {r.label}
          </Link>
        ))}
      </div>

      {byMetal.size === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No readings yet"
            body="Trends need readings. Once a week takes about ten seconds and builds an archive nobody else has — after two months there is a chart here worth looking at."
          />
        </div>
      ) : (
        [...byMetal.entries()].map(([metal, points]) => {
          const series = resample(points, range.key)
          const meta = METAL_LABEL[metal]
          return (
            <section key={metal} className="mt-9 max-w-2xl">
              <h2 className="text-[18px] font-semibold tracking-tight mb-0.5">
                {meta?.en ?? metal}
                {meta?.ne && <span className="ne text-[var(--color-ink-3)] font-normal text-[14px] ml-2">{meta.ne}</span>}
              </h2>
              <p className="text-[12.5px] text-[var(--color-ink-3)] mb-3">{range.blurb} · NPR per tola</p>
              <LineChart points={series} unit="NPR" label={meta?.en ?? metal}
                         stroke={meta?.colour} fill={`${meta?.colour ?? '#999'}14`} />
            </section>
          )
        })
      )}

      <div className="mt-12 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 max-w-2xl">
        <h3 className="text-[15px] font-semibold mb-1.5">How to read this</h3>
        <p className="text-[13.5px] text-[var(--color-ink-2)] mb-2">
          A tola is 11.6638 grams. Prices are the published rate for the metal itself — what a
          jeweller charges you also includes making charges and tax, so a finished ornament always
          costs more than the numbers here.
        </p>
        <p className="text-[13.5px] text-[var(--color-ink-2)] mb-0">
          This is a record of what prices have been. It is not a forecast, and nothing here is
          investment advice — we&rsquo;re not licensed to give any, and past movement doesn&rsquo;t
          tell you what happens next.
        </p>
      </div>

      <div className="mt-8">
        <Link href="/rates"
          className="inline-block no-underline rounded-lg border border-[var(--color-line)]
                     bg-[var(--color-surface)] px-4 py-2.5 text-[14px] hover:border-[var(--color-crimson)]">
          ← Exchange rates
        </Link>
      </div>
    </Container>
  )
}
