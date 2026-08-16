import Link from 'next/link'
import type { Metadata } from 'next'
import { Container, EmptyState } from '@/components/ui'
import { upcomingHolidays } from '@/db/hours'
import { currentSchedule } from '@/db/hours'
import { groupSpans, spanLabel, nepalDateKey, type HolidaySpan } from '@/lib/hours'
import { adToBs } from '@/lib/bs'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Nepal public holidays — what closes, and when',
  description:
    'When offices, banks and government services close in Nepal, in both calendars. ' +
    'Dashain and Tihar shut most of the country for days at a time — plan around them.',
  alternates: { canonical: '/holidays' },
}

/**
 * The same holiday rows as `/date`, aimed at someone planning a trip rather than
 * someone converting a date. A visitor's question is not "what is today?" but
 * "will anything be open while I'm there?" — and for Dashain the answer is a
 * week of closures that no itinerary tool warns them about.
 */
export default async function HolidaysPage() {
  let holidays: Awaited<ReturnType<typeof upcomingHolidays>> = []
  let schedule: Awaited<ReturnType<typeof currentSchedule>> = null
  try {
    holidays = await upcomingHolidays(200)
    schedule = await currentSchedule()
  } catch { /* build without a database */ }

  const spans = groupSpans(holidays)
  const long = spans.filter((s) => s.days >= 3)
  const today = nepalDateKey()
  const bsToday = adToBs(new Date(`${today}T00:00:00Z`))

  return (
    <Container className="py-10">
      <h1 className="text-[32px] sm:text-[38px] font-bold tracking-tight leading-[1.15] max-w-2xl">
        Public holidays in Nepal
      </h1>
      <p className="mt-4 text-[17px] text-[var(--color-ink-2)] max-w-2xl leading-relaxed">
        What closes, and when. Useful if you are planning a visit, applying for something at an
        office, or wondering why the bank is shut.
      </p>

      {schedule && (
        <div className="mt-7 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-4 max-w-2xl">
          <h2 className="text-[15px] font-semibold tracking-tight mb-1.5">The normal week</h2>
          <p className="text-[14px] text-[var(--color-ink-2)] mb-0">
            Government offices work <strong>Monday to Friday, {schedule.openTime}–{schedule.closeTime}</strong>,
            and close on Saturday and Sunday. This changed in April 2026 — Nepal ran a
            Sunday-to-Friday week for decades, so older guidebooks and half the internet still
            say Saturday is the only weekend day.
          </p>
        </div>
      )}

      {long.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[20px] font-semibold tracking-tight mb-1">
            The ones that will actually disrupt your plans
          </h2>
          <p className="text-[13.5px] text-[var(--color-ink-3)] mb-4 max-w-2xl">
            Three days or longer. During Dashain much of the country travels home — shops shut,
            buses fill weeks ahead, and government offices stop entirely.
          </p>
          <ul className="grid sm:grid-cols-2 gap-3">
            {long.map((h, i) => <BigCard key={i} span={h} />)}
          </ul>
        </section>
      )}

      <section className="mt-12">
        <h2 className="text-[20px] font-semibold tracking-tight mb-1">Everything ahead</h2>
        <p className="text-[13.5px] text-[var(--color-ink-3)] mb-4 max-w-2xl">
          From today{bsToday && <> — {bsToday.year}/{String(bsToday.month).padStart(2, '0')}/{String(bsToday.day).padStart(2, '0')} BS</>}.
          Marked <strong className="text-[var(--color-ink-2)]">unconfirmed</strong> where we have the
          date from a secondary source and haven&rsquo;t checked it against the Nepal Gazette
          ourselves.
        </p>

        {spans.length === 0 ? (
          <EmptyState title="No holidays loaded"
                      body="Run the hours seed and the calendar appears here." />
        ) : (
          <ul className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]
                         divide-y divide-[var(--color-line)]">
            {spans.map((h, i) => (
              <li key={i} className="px-4 py-3 flex items-baseline gap-3 flex-wrap">
                <span className="text-[14.5px] font-medium">{h.nameEn}</span>
                {h.nameNe && <span className="ne text-[13px] text-[var(--color-ink-3)]">{h.nameNe}</span>}
                {h.days > 1 && (
                  <span className="text-[11.5px] text-[var(--color-ink-3)]">{h.days} days</span>
                )}
                {!h.published && (
                  <span className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]
                                   border border-[var(--color-line)] rounded-full px-2 py-0.5">
                    unconfirmed
                  </span>
                )}
                <span className="ml-auto text-[12.5px] text-[var(--color-ink-3)] tabular-nums shrink-0">
                  {spanLabel(h)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-12 max-w-2xl">
        <h2 className="text-[17px] font-semibold tracking-tight mb-2">A few things worth knowing</h2>
        <ul className="text-[14.5px] text-[var(--color-ink-2)] leading-relaxed space-y-2 pl-5">
          <li>
            Not every holiday closes everything. Banks, government offices and private businesses
            keep different lists, and some holidays apply to one community or province rather than
            the whole country.
          </li>
          <li>
            Chhath is observed most widely in Madhesh province; the Lhosars are observed by
            different communities on different dates. A shop in Thamel may be open when an office
            in Janakpur is not.
          </li>
          <li>
            Dates for most Nepali festivals follow the lunar calendar, so they move each year.
            Anything more than a year out is a projection, not a schedule.
          </li>
          <li>
            Tourist sites, hotels and restaurants generally stay open through festivals — it is
            offices, banks and long-distance transport that stop.
          </li>
        </ul>
      </section>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link href="/date" className="inline-block no-underline rounded-lg border border-[var(--color-line)]
                     bg-[var(--color-surface)] px-4 py-2.5 text-[14px] hover:border-[var(--color-crimson)]">
          Convert a Nepali date →
        </Link>
        <Link href="/gov" className="inline-block no-underline rounded-lg border border-[var(--color-line)]
                     bg-[var(--color-surface)] px-4 py-2.5 text-[14px] hover:border-[var(--color-crimson)]">
          Find a government office →
        </Link>
      </div>
    </Container>
  )
}

function BigCard({ span }: { span: HolidaySpan }) {
  return (
    <li className="rounded-xl border border-[var(--color-line)] border-l-[3px]
                   border-l-[var(--color-crimson)] bg-[var(--color-surface)] px-4 py-3.5">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[16px] font-semibold tracking-tight">{span.nameEn}</span>
        {span.nameNe && <span className="ne text-[13.5px] text-[var(--color-ink-3)]">{span.nameNe}</span>}
      </div>
      <div className="text-[13.5px] text-[var(--color-ink-2)] mt-1 tabular-nums">{spanLabel(span)}</div>
      <div className="text-[12.5px] text-[var(--color-ink-3)] mt-1">
        {span.days} days
        {!span.published && ' · dates unconfirmed'}
      </div>
      {span.appliesToNote && (
        <p className="text-[12.5px] text-[var(--color-ink-2)] mt-1.5 mb-0">{span.appliesToNote}</p>
      )}
    </li>
  )
}
