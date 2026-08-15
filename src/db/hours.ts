import { db } from './index'
import { officeSchedule, holiday, source } from './schema'
import { eq, and, or, isNull, lte, gte, desc } from 'drizzle-orm'
import type { Schedule, Holiday } from '@/lib/hours'
import { nepalDateKey } from '@/lib/hours'

/**
 * The schedule in force today. Superseded rows are kept — when the Cabinet
 * changes the working week again we insert a row and set `effective_to` on the
 * old one, so the site can still answer "what were the hours last Baisakh?"
 */
export async function currentSchedule(): Promise<Schedule | null> {
  const today = nepalDateKey()
  const [row] = await db
    .select({
      labelEn: officeSchedule.labelEn, labelNe: officeSchedule.labelNe,
      openDays: officeSchedule.openDays, openTime: officeSchedule.openTime,
      closeTime: officeSchedule.closeTime, shortDay: officeSchedule.shortDay,
      shortCloseTime: officeSchedule.shortCloseTime, note: officeSchedule.note,
      sourceLabel: source.label, sourceUrl: source.url,
    })
    .from(officeSchedule)
    .leftJoin(source, eq(source.id, officeSchedule.sourceId))
    .where(and(
      eq(officeSchedule.published, true),
      eq(officeSchedule.scope, 'national'),
      lte(officeSchedule.effectiveFrom, today),
      or(isNull(officeSchedule.effectiveTo), gte(officeSchedule.effectiveTo, today)),
    ))
    .orderBy(desc(officeSchedule.effectiveFrom))
    .limit(1)

  return row ?? null
}

/** Holidays from today forward. Both published and not — the caller decides. */
export async function upcomingHolidays(limit = 40): Promise<Holiday[]> {
  const today = nepalDateKey()
  return db
    .select({
      nameEn: holiday.nameEn, nameNe: holiday.nameNe, date: holiday.date,
      published: holiday.published, appliesToNote: holiday.appliesToNote,
    })
    .from(holiday)
    .where(gte(holiday.date, today))
    .orderBy(holiday.date)
    .limit(limit)
}
