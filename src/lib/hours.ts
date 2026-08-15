/**
 * "Is it worth going today?"
 *
 * The honest answer has three states, not two. We know the weekly pattern from
 * a sourced Cabinet decision. We have a holiday list we have NOT yet confirmed
 * against the Gazette. Treating an unconfirmed holiday as a confident "closed"
 * would be overclaiming; ignoring it would send someone on a six-hour bus ride
 * on Dashain. So an unconfirmed holiday produces `maybe`, with the reason shown.
 */

import { adToBs, todayInNepal, WEEKDAYS_EN, WEEKDAYS_NE } from './bs'

export type Schedule = {
  labelEn: string
  labelNe: string | null
  openDays: number[]
  openTime: string
  closeTime: string
  shortDay: number | null
  shortCloseTime: string | null
  note: string | null
  sourceLabel?: string | null
  sourceUrl?: string | null
}

export type Holiday = {
  nameEn: string
  nameNe: string | null
  date: string            // 'YYYY-MM-DD'
  published: boolean
  appliesToNote: string | null
}

export type OpenState = {
  status: 'open' | 'closed' | 'maybe'
  headline: string
  detail: string | null
  hours: string | null
  weekdayEn: string
  weekdayNe: string
  /** The holiday responsible, if any — so the caller can name and link it. */
  holiday: Holiday | null
}

/** 'HH:MM' → minutes since midnight, or null if malformed. */
function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm)
  if (!m) return null
  const h = Number(m[1]), min = Number(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

function pretty(hhmm: string): string {
  const mins = toMinutes(hhmm)
  if (mins === null) return hhmm
  const h = Math.floor(mins / 60), m = mins % 60
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`
}

/** Local calendar date in Nepal as 'YYYY-MM-DD'. */
export function nepalDateKey(now: Date = new Date()): string {
  return todayInNepal(now).toISOString().slice(0, 10)
}

/** Minutes since midnight, Nepal time (UTC+05:45). */
function nepalMinutesNow(now: Date): number {
  const shifted = new Date(now.getTime() + (5 * 60 + 45) * 60_000)
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes()
}

export function evaluateOpen(
  schedule: Schedule | null,
  holidays: Holiday[],
  now: Date = new Date(),
): OpenState | null {
  if (!schedule) return null

  const today = todayInNepal(now)
  const key = today.toISOString().slice(0, 10)
  const dow = today.getUTCDay()
  const weekdayEn = WEEKDAYS_EN[dow]
  const weekdayNe = WEEKDAYS_NE[dow]

  const isShort = schedule.shortDay === dow && !!schedule.shortCloseTime
  const closeTime = isShort ? schedule.shortCloseTime! : schedule.closeTime
  const hours = `${pretty(schedule.openTime)} – ${pretty(closeTime)}`

  const todayHoliday = holidays.find((h) => h.date === key) ?? null

  // A confirmed holiday is the strongest signal — it beats the weekly pattern.
  if (todayHoliday?.published) {
    return {
      status: 'closed', holiday: todayHoliday, weekdayEn, weekdayNe, hours: null,
      headline: `Closed today — ${todayHoliday.nameEn}`,
      detail: todayHoliday.appliesToNote ?? 'Public holiday.',
    }
  }

  if (!schedule.openDays.includes(dow)) {
    return {
      status: 'closed', holiday: null, weekdayEn, weekdayNe, hours: null,
      headline: `Closed today — ${weekdayEn}`,
      detail: schedule.note ?? `Government offices are closed on ${weekdayEn}s.`,
    }
  }

  // Open by the weekly pattern, but our unconfirmed list flags this date.
  if (todayHoliday) {
    return {
      status: 'maybe', holiday: todayHoliday, weekdayEn, weekdayNe, hours,
      headline: `Possibly closed — ${todayHoliday.nameEn}`,
      detail:
        'Our holiday list has this date, but we have not confirmed it against the Nepal Gazette. ' +
        'Phone ahead before you travel.',
    }
  }

  const mins = nepalMinutesNow(now)
  const open = toMinutes(schedule.openTime), close = toMinutes(closeTime)
  const withinHours = open !== null && close !== null && mins >= open && mins < close

  return {
    status: 'open', holiday: null, weekdayEn, weekdayNe, hours,
    headline: withinHours ? 'Open now' : 'Open today',
    detail: withinHours
      ? null
      : (open !== null && mins < open ? `Opens at ${pretty(schedule.openTime)}.` : `Closed for the day — reopens ${pretty(schedule.openTime)}.`),
  }
}

/** The next few holidays from today, for a "plan around these" list. */
export function upcoming(holidays: Holiday[], limit = 6, now: Date = new Date()): Holiday[] {
  const key = nepalDateKey(now)
  return holidays
    .filter((h) => h.date >= key)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit)
}

/** Display helper: '16 Aug 2026 · Shrawan 31, 2083'. */
export function bothCalendars(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`)
  const bs = adToBs(d)
  const ad = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
  return bs ? `${ad} · ${bs.year}/${String(bs.month).padStart(2, '0')}/${String(bs.day).padStart(2, '0')}` : ad
}

export type HolidaySpan = {
  nameEn: string
  nameNe: string | null
  from: string
  to: string
  days: number
  published: boolean
  appliesToNote: string | null
}

/**
 * Collapse consecutive days of the same holiday into one span.
 * Dashain is stored as seven rows because the question is always about a single
 * date — but a list showing "Dashain" seven times is useless to read, and would
 * push every other holiday off the page.
 */
export function groupSpans(holidays: Holiday[]): HolidaySpan[] {
  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date) || a.nameEn.localeCompare(b.nameEn))
  const out: HolidaySpan[] = []

  for (const h of sorted) {
    const last = out.find((s) => s.nameEn === h.nameEn && isNextDay(s.to, h.date))
    if (last) {
      last.to = h.date
      last.days++
      last.published = last.published && h.published
      continue
    }
    out.push({
      nameEn: h.nameEn, nameNe: h.nameNe, from: h.date, to: h.date, days: 1,
      published: h.published, appliesToNote: h.appliesToNote,
    })
  }
  return out.sort((a, b) => a.from.localeCompare(b.from))
}

function isNextDay(prev: string, next: string): boolean {
  return new Date(`${next}T00:00:00Z`).getTime() - new Date(`${prev}T00:00:00Z`).getTime() === 86_400_000
}

/** '17–23 Oct 2026 · 2083/06/31–07/06' for a span, or a single date. */
export function spanLabel(span: HolidaySpan): string {
  if (span.days === 1) return bothCalendars(span.from)
  const a = new Date(`${span.from}T00:00:00Z`)
  const b = new Date(`${span.to}T00:00:00Z`)
  const sameMonth = a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()
  const fmt = (d: Date, withMonth: boolean) =>
    d.toLocaleDateString('en-GB', {
      day: 'numeric', ...(withMonth ? { month: 'short', year: 'numeric' } : {}), timeZone: 'UTC',
    })
  const range = sameMonth ? `${fmt(a, false)}–${fmt(b, true)}` : `${fmt(a, true)} – ${fmt(b, true)}`
  const bsA = adToBs(a), bsB = adToBs(b)
  const bs = bsA && bsB
    ? ` · ${bsA.year}/${String(bsA.month).padStart(2, '0')}/${String(bsA.day).padStart(2, '0')}–${String(bsB.month).padStart(2, '0')}/${String(bsB.day).padStart(2, '0')}`
    : ''
  return `${range}${bs}`
}
