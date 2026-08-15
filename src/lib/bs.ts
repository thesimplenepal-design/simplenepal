/**
 * Bikram Sambat ↔ Gregorian conversion.
 *
 * Every Nepali government form wants a BS date, and every foreign document
 * carries an AD one. That mismatch is a daily tax on anyone dealing with an
 * office, so this is a first-class utility rather than a nicety.
 *
 * The BS calendar is not arithmetic — month lengths vary year to year and are
 * fixed by observation, published in advance. So conversion is a lookup table
 * plus a day count from a known anchor, not a formula. The table below covers
 * 2000–2090 BS; outside that range we return null rather than extrapolate,
 * because a silently wrong date on a passport form is worse than no answer.
 *
 * Anchor: 1 Baisakh 2000 BS = 14 April 1943 AD.
 */

const BS_START_YEAR = 2000
const BS_EPOCH_UTC = Date.UTC(1943, 3, 14)   // 14 April 1943
const MS_PER_DAY = 86_400_000

/** Days in each of the 12 months, one row per BS year from 2000. */
const MONTH_DAYS: readonly (readonly number[])[] = [
  /* 2000 */ [30,32,31,32,31,30,30,30,29,30,29,31],
  /* 2001 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2002 */ [31,31,32,32,31,30,30,29,30,29,30,30],
  /* 2003 */ [31,32,31,32,31,30,30,30,29,29,30,31],
  /* 2004 */ [30,32,31,32,31,30,30,30,29,30,29,31],
  /* 2005 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2006 */ [31,31,32,32,31,30,30,29,30,29,30,30],
  /* 2007 */ [31,32,31,32,31,30,30,30,29,29,30,31],
  /* 2008 */ [31,31,31,32,31,31,29,30,30,29,29,31],
  /* 2009 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2010 */ [31,31,32,32,31,30,30,29,30,29,30,30],
  /* 2011 */ [31,32,31,32,31,30,30,30,29,29,30,31],
  /* 2012 */ [31,31,31,32,31,31,29,30,30,29,30,30],
  /* 2013 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2014 */ [31,31,32,32,31,30,30,29,30,29,30,30],
  /* 2015 */ [31,32,31,32,31,30,30,30,29,29,30,31],
  /* 2016 */ [31,31,31,32,31,31,29,30,30,29,30,30],
  /* 2017 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2018 */ [31,32,31,32,31,30,30,29,30,29,30,30],
  /* 2019 */ [31,32,31,32,31,30,30,30,29,30,29,31],
  /* 2020 */ [31,31,31,32,31,31,30,29,30,29,30,30],
  /* 2021 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2022 */ [31,32,31,32,31,30,30,30,29,29,30,30],
  /* 2023 */ [31,32,31,32,31,30,30,30,29,30,29,31],
  /* 2024 */ [31,31,31,32,31,31,30,29,30,29,30,30],
  /* 2025 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2026 */ [31,32,31,32,31,30,30,30,29,29,30,31],
  /* 2027 */ [30,32,31,32,31,30,30,30,29,30,29,31],
  /* 2028 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2029 */ [31,31,32,31,32,30,30,29,30,29,30,30],
  /* 2030 */ [31,32,31,32,31,30,30,30,29,29,30,31],
  /* 2031 */ [30,32,31,32,31,30,30,30,29,30,29,31],
  /* 2032 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2033 */ [31,31,32,32,31,30,30,29,30,29,30,30],
  /* 2034 */ [31,32,31,32,31,30,30,30,29,29,30,31],
  /* 2035 */ [30,32,31,32,31,31,29,30,30,29,29,31],
  /* 2036 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2037 */ [31,31,32,32,31,30,30,29,30,29,30,30],
  /* 2038 */ [31,32,31,32,31,30,30,30,29,29,30,31],
  /* 2039 */ [31,31,31,32,31,31,29,30,30,29,30,30],
  /* 2040 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2041 */ [31,31,32,32,31,30,30,29,30,29,30,30],
  /* 2042 */ [31,32,31,32,31,30,30,30,29,29,30,31],
  /* 2043 */ [31,31,31,32,31,31,29,30,30,29,30,30],
  /* 2044 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2045 */ [31,32,31,32,31,30,30,29,30,29,30,30],
  /* 2046 */ [31,32,31,32,31,30,30,30,29,29,30,31],
  /* 2047 */ [31,31,31,32,31,31,30,29,30,29,30,30],
  /* 2048 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2049 */ [31,32,31,32,31,30,30,30,29,29,30,30],
  /* 2050 */ [31,32,31,32,31,30,30,30,29,30,29,31],
  /* 2051 */ [31,31,31,32,31,31,30,29,30,29,30,30],
  /* 2052 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2053 */ [31,32,31,32,31,30,30,30,29,29,30,30],
  /* 2054 */ [31,32,31,32,31,30,30,30,29,30,29,31],
  /* 2055 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2056 */ [31,31,32,31,32,30,30,29,30,29,30,30],
  /* 2057 */ [31,32,31,32,31,30,30,30,29,29,30,31],
  /* 2058 */ [30,32,31,32,31,30,30,30,29,30,29,31],
  /* 2059 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2060 */ [31,31,32,32,31,30,30,29,30,29,30,30],
  /* 2061 */ [31,32,31,32,31,30,30,30,29,29,30,31],
  /* 2062 */ [30,32,31,32,31,31,29,30,29,30,29,31],
  /* 2063 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2064 */ [31,31,32,32,31,30,30,29,30,29,30,30],
  /* 2065 */ [31,32,31,32,31,30,30,30,29,29,30,31],
  /* 2066 */ [31,31,31,32,31,31,29,30,30,29,29,31],
  /* 2067 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2068 */ [31,31,32,32,31,30,30,29,30,29,30,30],
  /* 2069 */ [31,32,31,32,31,30,30,30,29,29,30,31],
  /* 2070 */ [31,31,31,32,31,31,29,30,30,29,30,30],
  /* 2071 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2072 */ [31,32,31,32,31,30,30,29,30,29,30,30],
  /* 2073 */ [31,32,31,32,31,30,30,30,29,29,30,31],
  /* 2074 */ [31,31,31,32,31,31,30,29,30,29,30,30],
  /* 2075 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2076 */ [31,32,31,32,31,30,30,30,29,29,30,30],
  /* 2077 */ [31,32,31,32,31,30,30,30,29,30,29,31],
  /* 2078 */ [31,31,31,32,31,31,30,29,30,29,30,30],
  /* 2079 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2080 */ [31,32,31,32,31,30,30,30,29,29,30,30],
  /* 2081 */ [31,32,31,32,31,30,30,30,29,30,29,31],
  /* 2082 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2083 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2084 */ [31,32,31,32,31,30,30,30,29,29,30,31],
  /* 2085 */ [30,32,31,32,31,30,30,30,29,30,29,31],
  /* 2086 */ [31,31,32,31,31,31,30,29,30,29,30,30],
  /* 2087 */ [31,31,32,31,31,31,30,30,29,30,30,30],
  /* 2088 */ [30,31,32,32,30,31,30,30,29,30,30,30],
  /* 2089 */ [30,32,31,32,31,30,30,30,29,30,30,30],
  /* 2090 */ [30,32,31,32,31,30,30,30,29,30,30,30],]

export const BS_MIN_YEAR = BS_START_YEAR
export const BS_MAX_YEAR = BS_START_YEAR + MONTH_DAYS.length - 1

export const BS_MONTHS_EN = [
  'Baisakh', 'Jestha', 'Asar', 'Shrawan', 'Bhadra', 'Asoj',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra',
] as const

export const BS_MONTHS_NE = [
  'बैशाख', 'जेठ', 'असार', 'श्रावण', 'भाद्र', 'आश्विन',
  'कार्तिक', 'मंसिर', 'पौष', 'माघ', 'फाल्गुन', 'चैत्र',
] as const

export const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const
export const WEEKDAYS_NE = ['आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहीबार', 'शुक्रबार', 'शनिबार'] as const

export type BsDate = { year: number; month: number; day: number }   // month is 1-12

const DEVANAGARI = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९']

/** 2083 → २०८३. Nepali forms and signage use these; Latin digits look foreign. */
export function neNum(n: number | string): string {
  return String(n).replace(/[0-9]/g, (d) => DEVANAGARI[Number(d)])
}

function daysInYear(bsYear: number): readonly number[] | null {
  return MONTH_DAYS[bsYear - BS_START_YEAR] ?? null
}

/** Whole days between two UTC instants, ignoring any time component. */
function dayDiff(aUtc: number, bUtc: number): number {
  return Math.round((aUtc - bUtc) / MS_PER_DAY)
}

/**
 * Gregorian → Bikram Sambat.
 * Pass a Date; only its UTC year/month/day are used, so callers must hand in a
 * date already expressed in the calendar day they mean (see `todayInNepal`).
 */
export function adToBs(date: Date): BsDate | null {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  let offset = dayDiff(utc, BS_EPOCH_UTC)
  if (offset < 0) return null

  let year = BS_START_YEAR
  for (;;) {
    const months = daysInYear(year)
    if (!months) return null                       // past the end of the table
    const total = months.reduce((a, b) => a + b, 0)
    if (offset < total) {
      for (let m = 0; m < 12; m++) {
        if (offset < months[m]) return { year, month: m + 1, day: offset + 1 }
        offset -= months[m]
      }
      return null                                  // unreachable given `total`
    }
    offset -= total
    year++
  }
}

/** Bikram Sambat → Gregorian. Returns a UTC-midnight Date. */
export function bsToAd(bs: BsDate): Date | null {
  const { year, month, day } = bs
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (month < 1 || month > 12 || day < 1) return null

  let offset = 0
  for (let y = BS_START_YEAR; y < year; y++) {
    const months = daysInYear(y)
    if (!months) return null
    offset += months.reduce((a, b) => a + b, 0)
  }

  const months = daysInYear(year)
  if (!months) return null
  if (day > months[month - 1]) return null         // e.g. 32 Poush in a 29-day Poush
  for (let m = 0; m < month - 1; m++) offset += months[m]
  offset += day - 1

  return new Date(BS_EPOCH_UTC + offset * MS_PER_DAY)
}

/** How many days a given BS month has — needed to bound a date picker. */
export function daysInBsMonth(year: number, month: number): number | null {
  const months = daysInYear(year)
  if (!months || month < 1 || month > 12) return null
  return months[month - 1]
}

/**
 * The calendar day it currently is in Nepal (UTC+05:45), as a UTC-midnight Date.
 * Servers run in UTC; "today" on a page read in Kathmandu is not the server's
 * today for 5 hours 45 minutes of every day.
 */
export function todayInNepal(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + (5 * 60 + 45) * 60_000)
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()))
}

export function formatBs(bs: BsDate, lang: 'en' | 'ne' = 'en'): string {
  return lang === 'ne'
    ? `${BS_MONTHS_NE[bs.month - 1]} ${neNum(bs.day)}, ${neNum(bs.year)}`
    : `${BS_MONTHS_EN[bs.month - 1]} ${bs.day}, ${bs.year}`
}

export function formatAd(d: Date, lang: 'en' | 'ne' = 'en'): string {
  return d.toLocaleDateString(lang === 'ne' ? 'ne-NP' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

/** 0 = Sunday. Same indexing as Date.getUTCDay, for the weekday name tables. */
export function weekdayOf(d: Date): number {
  return d.getUTCDay()
}
