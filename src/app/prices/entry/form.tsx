'use client'

import { useState } from 'react'

const field =
  'w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-3 ' +
  'text-[16px] focus:outline-none focus:border-[var(--color-crimson)]'

const CONTEXTS = [
  { v: 'local_area', label: 'Local area' },
  { v: 'tourist_area', label: 'Tourist area' },
  { v: 'airport', label: 'Airport' },
  { v: 'online', label: 'App / tariff' },
] as const

type Item = { id: number; slug: string; nameEn: string; unit: string }

export function PriceForm({ items, today }: { items: Item[]; today: string }) {
  const [itemId, setItemId] = useState(items[0]?.id ?? 0)
  const [amount, setAmount] = useState('')
  const [context, setContext] = useState<string>('local_area')
  const [placeNote, setPlaceNote] = useState('')
  const [note, setNote] = useState('')
  const [observedAt, setObservedAt] = useState(today)
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  const item = items.find((i) => i.id === itemId)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setState('saving'); setMsg('')
    try {
      const res = await fetch('/api/price', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, amount, context, placeNote, note, observedAt }),
      })
      const j = await res.json()
      if (!j.ok) { setState('error'); setMsg(j.error ?? 'failed'); return }
      setState('done')
      setMsg(`Saved: ${j.item} — NPR ${j.amount.toLocaleString()}`)
      // Keep the item and context selected: observations come in runs, and
      // re-picking the same thing three times is how a capture tool gets abandoned.
      setAmount(''); setPlaceNote(''); setNote('')
    } catch (err) {
      setState('error'); setMsg(String(err))
    }
  }

  return (
    <form onSubmit={submit} className="mt-7 max-w-md">
      <label className="block mb-4">
        <span className="block text-[12px] uppercase tracking-wider text-[var(--color-ink-3)] mb-1.5">
          What
        </span>
        <select className={field} value={itemId} onChange={(e) => setItemId(Number(e.target.value))}>
          {items.map((i) => <option key={i.id} value={i.id}>{i.nameEn}</option>)}
        </select>
      </label>

      <label className="block mb-4">
        <span className="block text-[12px] uppercase tracking-wider text-[var(--color-ink-3)] mb-1.5">
          Price in NPR {item && <span className="normal-case tracking-normal">· {item.unit}</span>}
        </span>
        <input className={`${field} tabular-nums`} inputMode="numeric" value={amount}
               placeholder="e.g. 900" onChange={(e) => setAmount(e.target.value)} />
      </label>

      <div className="mb-4">
        <span className="block text-[12px] uppercase tracking-wider text-[var(--color-ink-3)] mb-1.5">
          Where
        </span>
        <div className="grid grid-cols-2 gap-2">
          {CONTEXTS.map((c) => (
            <button key={c.v} type="button" onClick={() => setContext(c.v)}
              aria-pressed={context === c.v}
              className={`min-h-11 rounded-lg border text-[14px] px-2 ${
                context === c.v
                  ? 'border-[var(--color-crimson)] bg-[var(--color-crimson-soft)] font-medium'
                  : 'border-[var(--color-line)] bg-[var(--color-surface)]'}`}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <label className="block mb-4">
        <span className="block text-[12px] uppercase tracking-wider text-[var(--color-ink-3)] mb-1.5">
          Exactly where <span className="normal-case tracking-normal">(optional)</span>
        </span>
        <input className={field} value={placeNote} placeholder="Thamel, TIA arrivals, Kirtipur…"
               onChange={(e) => setPlaceNote(e.target.value)} />
      </label>

      <label className="block mb-4">
        <span className="block text-[12px] uppercase tracking-wider text-[var(--color-ink-3)] mb-1.5">
          Note <span className="normal-case tracking-normal">(optional)</span>
        </span>
        <input className={field} value={note} placeholder="asked 1200, paid 900"
               onChange={(e) => setNote(e.target.value)} />
      </label>

      <label className="block mb-5">
        <span className="block text-[12px] uppercase tracking-wider text-[var(--color-ink-3)] mb-1.5">
          When
        </span>
        <input type="date" className={field} value={observedAt} max={today}
               onChange={(e) => setObservedAt(e.target.value)} />
      </label>

      <button type="submit" disabled={state === 'saving' || !amount}
        className="w-full rounded-lg bg-[var(--color-ink)] text-[var(--color-surface)]
                   px-4 py-3.5 text-[15px] font-medium disabled:opacity-50">
        {state === 'saving' ? 'Saving…' : 'Record this price'}
      </button>

      {msg && (
        <p className={`text-[13.5px] mt-3 mb-0 ${
          state === 'error' ? 'text-[var(--color-crimson)]' : 'text-[var(--color-ink-2)]'}`}>
          {msg}
        </p>
      )}

      <p className="text-[12.5px] text-[var(--color-ink-3)] mt-5 mb-0">
        Record what was <em>actually paid</em>, not what was first asked. If you were quoted 1,200
        and paid 900, the observation is 900 and the note says the rest — an archive of opening
        quotes would tell nobody anything true.
      </p>
    </form>
  )
}
