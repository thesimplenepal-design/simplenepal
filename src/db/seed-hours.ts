/**
 * Seeds the office schedule and the public holiday calendar.
 *
 *   npm run seed:hours
 *
 * Two different confidence levels, deliberately:
 *
 * The WEEKLY PATTERN is published. Two independent outlets report the same
 * Cabinet decision of 5 April 2026 — offices move to 9am–5pm with a Saturday
 * and Sunday weekend, effective 6 April 2026. Reporting described it as tied to
 * fuel supply and "subject to periodic review", so it is stored with an
 * effective-from date and can be superseded by inserting a row, never by
 * editing code.
 *
 * The HOLIDAYS are not published. The list is attributed to Nepal Gazette
 * Vol 75 No 67 (2 March 2026), but we read it through a secondary aggregator,
 * not the Gazette itself. Unpublished holidays produce "possibly closed — not
 * confirmed" rather than a confident "closed". Confirm against the Gazette,
 * then flip `published`.
 */
import 'dotenv/config'
import { db } from './index'
import { officeSchedule, holiday, source } from './schema'
import { eq } from 'drizzle-orm'
import { adToBs } from '../lib/bs'

type SourceKind = (typeof source.kind.enumValues)[number]

async function upsertSource(v: { kind: SourceKind; label: string; url?: string }) {
  const [existing] = await db.select().from(source).where(eq(source.label, v.label)).limit(1)
  if (existing) return existing
  const [row] = await db.insert(source).values(v).returning()
  return row
}

async function main() {
  const srcHours = await upsertSource({
    kind: 'web',
    label: 'Fiscal Nepal / OnlineKhabar, Cabinet decision of 5 April 2026 — government office hours set to 9am–5pm with a Saturday–Sunday weekend from 6 April 2026',
    url: 'https://www.fiscalnepal.com/2026/04/05/25384/nepal-sets-government-office-hours-from-9-am-to-5-pm/',
  })

  const srcHolidays = await upsertSource({
    kind: 'web',
    label: 'Public holiday list for 2083 BS, attributed to Nepal Gazette Vol 75 No 67 (2 March 2026) — read via a secondary aggregator, NOT the Gazette itself',
    url: 'https://www.collegenp.com/article/list-of-public-holidays-of-nepal-2083',
  })

  // ── the weekly pattern ───────────────────────────────────────────────
  await db.insert(officeSchedule).values({
    scope: 'national',
    labelEn: 'Federal, province and local government offices',
    labelNe: 'सरकारी कार्यालय',
    openDays: [1, 2, 3, 4, 5],             // Monday–Friday; 0 = Sunday
    openTime: '09:00',
    closeTime: '17:00',
    effectiveFrom: '2026-04-06',
    sourceId: srcHours.id,
    note: 'Offices are closed Saturday and Sunday. This replaced the long-standing ' +
          'Sunday–Friday week in April 2026 and was described as subject to review, ' +
          'so check the date this was last confirmed.',
    published: true,
  }).onConflictDoNothing()
  console.log('✓ national office schedule: Mon–Fri, 9am–5pm, effective 6 Apr 2026 (published)')

  // ── the 2083 BS holiday calendar ─────────────────────────────────────
  // Multi-day festivals are expanded to one row per day, because the question
  // being asked is always about a single date.
  const RANGES: [string, string | null, string, string, string | null][] = [
    // nameEn, nameNe, firstDate, lastDate, appliesToNote
    ['Nepali New Year', 'नयाँ वर्ष', '2026-04-14', '2026-04-14', null],
    ['Buddha Jayanti / Ubhauli', 'बुद्ध जयन्ती', '2026-05-01', '2026-05-01', null],
    ['International Labour Day', 'मजदुर दिवस', '2026-05-01', '2026-05-01', null],
    ['Republic Day', 'गणतन्त्र दिवस', '2026-05-29', '2026-05-29', null],
    ['Raksha Bandhan / Janai Purnima', 'जनै पूर्णिमा', '2026-08-28', '2026-08-28', null],
    ['Krishna Janmashtami', 'कृष्ण जन्माष्टमी', '2026-09-04', '2026-09-04', null],
    ['Constitution Day', 'संविधान दिवस', '2026-09-19', '2026-09-19', null],
    ['Ghatasthapana', 'घटस्थापना', '2026-10-11', '2026-10-11', null],
    ['Dashain', 'दशैं', '2026-10-17', '2026-10-23', null],
    ['Tihar', 'तिहार', '2026-11-08', '2026-11-12', null],
    ['Chhath', 'छठ', '2026-11-15', '2026-11-15', 'Observed most widely in the Madhesh province.'],
    ['Udhauli / Yomari Punhi', 'उधौली', '2026-12-24', '2026-12-24', null],
    ['Christmas Day', 'क्रिसमस', '2026-12-25', '2026-12-25', null],
    ['Tamu Lhosar', 'तमु ल्होसार', '2026-12-30', '2026-12-30', null],
    ['Prithvi Jayanti', 'पृथ्वी जयन्ती', '2027-01-11', '2027-01-11', null],
    ['Maghe Sankranti / Maghi', 'माघे संक्रान्ति', '2027-01-15', '2027-01-15', null],
    ["Martyrs' Day", 'सहिद दिवस', '2027-01-30', '2027-01-30', null],
    ['Sonam Lhosar', 'सोनाम ल्होसार', '2027-02-07', '2027-02-07', null],
    ['National Democracy Day', 'प्रजातन्त्र दिवस', '2027-02-19', '2027-02-19', null],
    ["International Women's Day", 'नारी दिवस', '2027-03-08', '2027-03-08', 'A holiday for women employees.'],
    ['Maha Shivaratri', 'महाशिवरात्री', '2027-03-06', '2027-03-06', null],
    ['Gyalpo Lhosar', 'ग्याल्पो ल्होसार', '2027-03-09', '2027-03-09', null],
    ['Fagu Purnima (Holi)', 'फागु पूर्णिमा', '2027-03-21', '2027-03-22', 'Hill districts on the first day, Terai on the second.'],
  ]

  const rows = RANGES.flatMap(([nameEn, nameNe, from, to, note]) => {
    const out = []
    for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += 86_400_000) {
      const d = new Date(t)
      const bs = adToBs(d)
      out.push({
        nameEn, nameNe,
        date: d.toISOString().slice(0, 10),
        bsYear: bs?.year ?? null, bsMonth: bs?.month ?? null, bsDay: bs?.day ?? null,
        scope: 'national' as const,
        appliesToNote: note,
        sourceId: srcHolidays.id,
        confidence: 65,
        published: false,          // not read from the Gazette — see header
        note: 'From a secondary source citing Nepal Gazette Vol 75 No 67. Confirm before publishing.',
      })
    }
    return out
  })

  await db.insert(holiday).values(rows).onConflictDoNothing()
  console.log(`✓ ${rows.length} holiday days across ${RANGES.length} holidays (unpublished — awaiting Gazette confirmation)`)
  console.log('\n✓ done.')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
