'use client'

import { useState } from 'react'

const field =
  'w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-3 text-[16px] ' +
  'tabular-nums focus:outline-none focus:border-[var(--color-crimson)]'

const FIELDS = [
  { key: 'gold_hallmark', label: 'Hallmark gold (chhapawal)', ne: 'छापावाल सुन', hint: 'per tola' },
  { key: 'gold_tejabi', label: 'Tejabi gold', ne: 'तेजाबी सुन', hint: 'per tola' },
  { key: 'silver', label: 'Silver', ne: 'चाँदी', hint: 'per tola' },
] as const

export function MetalForm({ today, last }: { today: string; last: Record<string, number> }) {
  const [date, setDate] = useState(today)
  const [vals, setVals] = useState<Record<string, string>>({})
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('saving'); setMsg('')
    try {
      const res = await fetch('/api/metal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, ...vals }),
      })
      const j = await res.json()
      if (!j.ok) { setState('error'); setMsg(j.error ?? 'failed'); return }
      setState('done'); setMsg(`Saved ${j.saved} reading${j.saved === 1 ? '' : 's'} for ${j.date}.`)
      setVals({})
    } catch (err) {
      setState('error'); setMsg(String(err))
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 max-w-md">
      <label className="block mb-4">
        <span className="block text-[12px] uppercase tracking-wider text-[var(--color-ink-3)] mb-1.5">
          Reading date
        </span>
        <input type="date" className={field} value={date} max={today}
               onChange={(e) => setDate(e.target.value)} />
      </label>

      {FIELDS.map((f) => (
        <label key={f.key} className="block mb-4">
          <span className="flex items-baseline gap-2 mb-1.5">
            <span className="text-[13.5px] font-medium">{f.label}</span>
            <span className="ne text-[12.5px] text-[var(--color-ink-3)]">{f.ne}</span>
          </span>
          <input
            className={field}
            inputMode="numeric"
            /* A phone keypad and a big target: this is done standing up, once a
               week, and friction here is what kills the whole archive. */
            placeholder={last[f.key] ? `last: ${last[f.key].toLocaleString()}` : f.hint}
            value={vals[f.key] ?? ''}
            onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))}
          />
        </label>
      ))}

      <button type="submit" disabled={state === 'saving'}
        className="w-full rounded-lg bg-[var(--color-ink)] text-[var(--color-surface)] px-4 py-3
                   text-[15px] font-medium disabled:opacity-50">
        {state === 'saving' ? 'Saving…' : 'Save reading'}
      </button>

      {msg && (
        <p className={`text-[13.5px] mt-3 mb-0 ${state === 'error' ? 'text-[var(--color-crimson)]' : 'text-[var(--color-ink-2)]'}`}>
          {msg}
        </p>
      )}

      <p className="text-[12.5px] text-[var(--color-ink-3)] mt-5 mb-0">
        Leave a field blank to skip it. Saving the same date twice overwrites that day, so a typo
        is fixed by entering it again.
      </p>
    </form>
  )
}
