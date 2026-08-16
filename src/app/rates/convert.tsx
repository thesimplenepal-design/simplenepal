'use client'

import { useState } from 'react'

export type Rate = { iso3: string; currencyName: string; unit: number; buy: string; sell: string }

const field =
  'w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2.5 text-[15px] ' +
  'focus:outline-none focus:border-[var(--color-crimson)]'

function money(v: number): string {
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function Convert({ rates }: { rates: Rate[] }) {
  const [iso, setIso] = useState(rates.find((r) => r.iso3 === 'USD')?.iso3 ?? rates[0]?.iso3 ?? '')
  const [amount, setAmount] = useState('100')
  const [dir, setDir] = useState<'to_npr' | 'from_npr'>('to_npr')

  const rate = rates.find((r) => r.iso3 === iso)
  const n = Number(amount.replace(/,/g, ''))
  const valid = Number.isFinite(n) && n >= 0 && !!rate

  // Buy is what a bank pays you for foreign currency; sell is what it charges.
  // Using one for both directions is the classic way to be quietly wrong.
  const perUnit = rate ? Number(dir === 'to_npr' ? rate.buy : rate.sell) / rate.unit : 0
  const result = valid ? (dir === 'to_npr' ? n * perUnit : n / perUnit) : 0

  return (
    <div className="mt-7 max-w-2xl">
      <div className="inline-flex rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-1 mb-5">
        {([['to_npr', 'To rupees'], ['from_npr', 'From rupees']] as const).map(([v, label]) => (
          <button key={v} type="button" onClick={() => setDir(v)} aria-pressed={dir === v}
            className={`px-4 py-2.5 min-h-10 rounded-md text-[13.5px] font-medium transition-colors ${
              dir === v ? 'bg-[var(--color-surface)] border border-[var(--color-line)] shadow-sm'
                        : 'text-[var(--color-ink-2)] border border-transparent'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_1.4fr] gap-3">
        <label className="block">
          <span className="block text-[12px] uppercase tracking-wider text-[var(--color-ink-3)] mb-1.5">Amount</span>
          <input className={field} value={amount} inputMode="decimal"
                 onChange={(e) => setAmount(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-[12px] uppercase tracking-wider text-[var(--color-ink-3)] mb-1.5">Currency</span>
          <select className={field} value={iso} onChange={(e) => setIso(e.target.value)}>
            {rates.map((r) => (
              <option key={r.iso3} value={r.iso3}>{r.iso3} — {r.currencyName}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-6 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-5 py-5">
        {valid && rate ? (
          <>
            <div className="text-[26px] font-semibold tracking-tight leading-tight">
              {dir === 'to_npr' ? `NPR ${money(result)}` : `${iso} ${money(result)}`}
            </div>
            <div className="text-[14px] text-[var(--color-ink-2)] mt-1.5">
              {dir === 'to_npr'
                ? `${n.toLocaleString()} ${iso} at the ${rate.unit === 1 ? '' : `per-${rate.unit} `}buying rate`
                : `${n.toLocaleString()} rupees at the selling rate`}
            </div>
            <div className="font-mono text-[12.5px] text-[var(--color-ink-3)] mt-2.5">
              {rate.unit === 1 ? '1' : rate.unit} {iso} = NPR {money(Number(dir === 'to_npr' ? rate.buy : rate.sell))}
            </div>
          </>
        ) : (
          <p className="text-[14px] text-[var(--color-ink-2)] mb-0">Enter an amount to convert.</p>
        )}
      </div>
    </div>
  )
}
