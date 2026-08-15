import type { Metadata } from 'next'
import { Container } from '@/components/ui'
import { adToBs, todayInNepal, formatBs, formatAd, weekdayOf, WEEKDAYS_EN, WEEKDAYS_NE } from '@/lib/bs'
import { upcomingHolidays } from '@/db/hours'
import { groupSpans, spanLabel } from '@/lib/hours'
import { Converter } from './converter'

// Today changes, so this page cannot be frozen at build time. An hour is close
// enough — nobody is refreshing at midnight in Kathmandu to watch it tick over.
export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Nepali date converter — BS to AD and AD to BS',
  description:
    'Convert Bikram Sambat to Gregorian and back. Every Nepali government form wants a BS ' +
    'date; every foreign document carries an AD one. Covers 2000–2090 BS.',
  alternates: { canonical: '/date' },
}

export default async function DatePage() {
  const today = todayInNepal()
  const todayBs = adToBs(today)
  const dow = weekdayOf(today)

  let holidays: Awaited<ReturnType<typeof upcomingHolidays>> = []
  try { holidays = (await upcomingHolidays(60)) } catch { /* build without a database */ }
  const spans = groupSpans(holidays).slice(0, 10)

  return (
    <Container className="py-10">
      <h1 className="text-[32px] sm:text-[38px] font-bold tracking-tight leading-[1.15] max-w-2xl">
        Nepali date converter
      </h1>
      <p className="mt-4 text-[17px] text-[--color-ink-2] max-w-2xl leading-relaxed">
        Every government form wants a Bikram Sambat date. Every passport, degree and foreign
        document carries a Gregorian one. Convert either way.
      </p>

      {todayBs && (
        <div className="mt-7 rounded-xl border border-[--color-line] bg-[--color-surface] px-5 py-4 max-w-2xl">
          <div className="text-[11.5px] uppercase tracking-wider text-[--color-ink-3]">Today in Nepal</div>
          <div className="text-[22px] font-semibold tracking-tight mt-1">{formatBs(todayBs)}</div>
          <div className="ne text-[16px] text-[--color-ink-2]">{formatBs(todayBs, 'ne')}</div>
          <div className="text-[13.5px] text-[--color-ink-3] mt-1.5">
            {formatAd(today)} · {WEEKDAYS_EN[dow]} <span className="ne">{WEEKDAYS_NE[dow]}</span>
          </div>
        </div>
      )}

      <Converter
        initialBsYear={todayBs?.year ?? 2083}
        initialBsMonth={todayBs?.month ?? 1}
        initialBsDay={todayBs?.day ?? 1}
        initialAd={today.toISOString().slice(0, 10)}
      />

      {spans.length > 0 && (
        <section className="mt-12 max-w-2xl">
          <h2 className="text-[19px] font-semibold tracking-tight mb-1">Holidays coming up</h2>
          <p className="text-[13.5px] text-[--color-ink-3] mb-4">
            Government offices close on these. Our list is attributed to the Nepal Gazette but we
            have read it through a secondary source, so we mark it{' '}
            <strong className="text-[--color-ink-2]">unconfirmed</strong> until someone checks the
            Gazette itself. Phone ahead before you travel on one of these days.
          </p>
          <ul className="rounded-xl border border-[--color-line] bg-[--color-surface]
                         divide-y divide-[--color-line]">
            {spans.map((h, i) => (
              <li key={`${h.from}-${i}`} className="px-4 py-2.5 flex items-baseline gap-3 flex-wrap">
                <span className="text-[14.5px] font-medium">{h.nameEn}</span>
                {h.nameNe && <span className="ne text-[13px] text-[--color-ink-3]">{h.nameNe}</span>}
                {h.days > 1 && (
                  <span className="text-[11.5px] text-[--color-ink-3]">{h.days} days</span>
                )}
                {!h.published && (
                  <span className="text-[10px] uppercase tracking-wider text-[--color-ink-3]
                                   border border-[--color-line] rounded-full px-2 py-0.5">
                    unconfirmed
                  </span>
                )}
                <span className="ml-auto text-[12.5px] text-[--color-ink-3] tabular-nums shrink-0">
                  {spanLabel(h)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-12 max-w-2xl">
        <h2 className="text-[17px] font-semibold tracking-tight mb-2">Why this isn&rsquo;t just arithmetic</h2>
        <p className="text-[14.5px] text-[--color-ink-2] leading-relaxed">
          Bikram Sambat months don&rsquo;t have fixed lengths. Asar can be 31 or 32 days depending on
          the year, and the lengths are fixed by observation and published in advance rather than
          derived from a formula. So conversion is a lookup against a published table, anchored at
          1 Baisakh 2000 BS = 14 April 1943.
        </p>
        <p className="text-[14.5px] text-[--color-ink-2] leading-relaxed">
          Our table covers <strong>2000 to 2090 BS</strong>. Ask for a date outside that and we say
          so rather than extrapolate — a plausible-looking wrong date on a citizenship or passport
          form costs you the journey, and we&rsquo;d rather answer nothing than answer wrongly.
        </p>
      </section>
    </Container>
  )
}
