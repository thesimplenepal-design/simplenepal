'use client'

import { useState } from 'react'
import {
  adToBs, bsToAd, daysInBsMonth, formatAd, formatBs, neNum, weekdayOf,
  BS_MONTHS_EN, BS_MONTHS_NE, WEEKDAYS_EN, WEEKDAYS_NE, BS_MIN_YEAR, BS_MAX_YEAR,
} from '@/lib/bs'

type Props = { initialBsYear: number; initialBsMonth: number; initialBsDay: number; initialAd: string }

const field =
  'w-full rounded-lg border border-[--color-line] bg-[--color-surface] px-3 py-2.5 text-[15px] ' +
  'focus:outline-none focus:border-[--color-crimson]'

export function Converter({ initialBsYear, initialBsMonth, initialBsDay, initialAd }: Props) {
  const [dir, setDir] = useState<'bs2ad' | 'ad2bs'>('bs2ad')

  const [by, setBy] = useState(initialBsYear)
  const [bm, setBm] = useState(initialBsMonth)
  const [bd, setBd] = useState(initialBsDay)
  const [ad, setAd] = useState(initialAd)

  const maxDay = daysInBsMonth(by, bm) ?? 32
  const bsResult = dir === 'bs2ad' ? bsToAd({ year: by, month: bm, day: Math.min(bd, maxDay) }) : null
  const adDate = dir === 'ad2bs' && ad ? new Date(`${ad}T00:00:00Z`) : null
  const adResult = adDate && !Number.isNaN(adDate.getTime()) ? adToBs(adDate) : null

  return (
    <div className="mt-7 max-w-2xl">
      <div className="inline-flex rounded-lg border border-[--color-line] bg-[--color-surface-2] p-1 mb-6">
        {([['bs2ad', 'BS → AD'], ['ad2bs', 'AD → BS']] as const).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setDir(v)}
            aria-pressed={dir === v}
            className={`px-4 py-1.5 rounded-md text-[13.5px] font-medium transition-colors ${
              dir === v
                ? 'bg-[--color-surface] border border-[--color-line] shadow-sm'
                : 'text-[--color-ink-2] border border-transparent'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {dir === 'bs2ad' ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="block text-[12px] uppercase tracking-wider text-[--color-ink-3] mb-1.5">Year</span>
              <input type="number" className={field} value={by} min={BS_MIN_YEAR} max={BS_MAX_YEAR}
                     inputMode="numeric"
                     onChange={(e) => setBy(Number(e.target.value))} />
            </label>
            <label className="block">
              <span className="block text-[12px] uppercase tracking-wider text-[--color-ink-3] mb-1.5">Month</span>
              <select className={field} value={bm} onChange={(e) => setBm(Number(e.target.value))}>
                {BS_MONTHS_EN.map((m, i) => (
                  <option key={m} value={i + 1}>{m} · {BS_MONTHS_NE[i]}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="block text-[12px] uppercase tracking-wider text-[--color-ink-3] mb-1.5">Day</span>
              <input type="number" className={field} value={bd} min={1} max={maxDay}
                     inputMode="numeric"
                     onChange={(e) => setBd(Number(e.target.value))} />
            </label>
          </div>
          <p className="text-[12.5px] text-[--color-ink-3] mt-2">
            {BS_MONTHS_EN[bm - 1]} {by} has {maxDay} days.
          </p>

          <Result
            valid={!!bsResult}
            big={bsResult ? formatAd(bsResult) : null}
            sub={bsResult ? `${WEEKDAYS_EN[weekdayOf(bsResult)]} · ${WEEKDAYS_NE[weekdayOf(bsResult)]}` : null}
            iso={bsResult ? bsResult.toISOString().slice(0, 10) : null}
          />
        </>
      ) : (
        <>
          <label className="block">
            <span className="block text-[12px] uppercase tracking-wider text-[--color-ink-3] mb-1.5">
              Gregorian date
            </span>
            <input type="date" className={`${field} max-w-xs`} value={ad}
                   onChange={(e) => setAd(e.target.value)} />
          </label>

          <Result
            valid={!!adResult}
            big={adResult ? formatBs(adResult) : null}
            sub={
              adResult && adDate
                ? `${formatBs(adResult, 'ne')} · ${WEEKDAYS_EN[weekdayOf(adDate)]} · ${WEEKDAYS_NE[weekdayOf(adDate)]}`
                : null
            }
            iso={adResult ? `${neNum(adResult.year)}/${neNum(adResult.month)}/${neNum(adResult.day)}` : null}
          />
        </>
      )}
    </div>
  )
}

function Result({ valid, big, sub, iso }: {
  valid: boolean; big: string | null; sub: string | null; iso: string | null
}) {
  if (!valid) {
    return (
      <div className="mt-6 rounded-xl border border-[--color-line] bg-[--color-surface-2] px-5 py-4">
        <p className="text-[14px] text-[--color-ink-2] mb-0">
          That date doesn&rsquo;t exist in the calendar we have. Our table runs from{' '}
          {BS_MIN_YEAR} to {BS_MAX_YEAR} BS — outside that we&rsquo;d be guessing, and a wrong date
          on a government form costs you the trip.
        </p>
      </div>
    )
  }
  return (
    <div className="mt-6 rounded-xl border border-[--color-line] bg-[--color-surface] px-5 py-5">
      <div className="text-[26px] font-semibold tracking-tight leading-tight">{big}</div>
      {sub && <div className="text-[14px] text-[--color-ink-2] mt-1.5">{sub}</div>}
      {iso && <div className="font-mono text-[12.5px] text-[--color-ink-3] mt-2.5">{iso}</div>}
    </div>
  )
}
