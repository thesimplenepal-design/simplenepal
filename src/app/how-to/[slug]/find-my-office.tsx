'use client'

import { useState } from 'react'

/**
 * "Which office serves ME?"
 *
 * This is the part every other site gets wrong. A citizen does not want the
 * NEAREST office — they want the one with authority over their ward. Sending
 * someone to the wrong counter costs them a day, a bus fare, and their trust.
 *
 * v1 resolves to the local government office for the place they pick. Ward-level
 * jurisdiction (where a district office splits wards between counters) gets
 * layered on as we confirm it, office by office, by phone.
 */
export function FindMyOffice({ serviceSlug }: { serviceSlug: string }) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<{ slug: string; label: string }[] | null>(null)
  const [busy, setBusy] = useState(false)

  async function search(term: string) {
    setQ(term)
    if (term.trim().length < 3) { setResults(null); return }
    setBusy(true)
    try {
      const r = await fetch(
        `/api/office-for?service=${encodeURIComponent(serviceSlug)}&q=${encodeURIComponent(term)}`,
      )
      setResults(r.ok ? await r.json() : [])
    } catch { setResults([]) }
    setBusy(false)
  }

  return (
    <section className="mt-8 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 sm:p-5">
      <h2 className="text-[16px] font-semibold tracking-tight">Which office do I go to?</h2>
      <p className="text-[13.5px] text-[var(--color-ink-2)] mt-1 mb-3">
        Type your municipality or rural municipality — not the nearest office, the one that actually
        serves you.
      </p>
      <input
        value={q}
        onChange={(e) => search(e.target.value)}
        placeholder="e.g. Kathmandu, Pokhara, Rajbiraj…"
        aria-label="Your municipality or rural municipality"
        className="w-full h-11 px-3.5 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] text-[15px]"
      />

      {busy && <p className="text-[13px] text-[var(--color-ink-3)] mt-2 mb-0">Looking…</p>}

      {results && !busy && (
        results.length === 0 ? (
          <p className="text-[13.5px] text-[var(--color-ink-3)] mt-3 mb-0">
            No match. Try the municipality name rather than the ward or the town.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {results.map((r) => (
              <li key={r.slug}>
                <a href={`/gov/${r.slug}`}
                   className="block no-underline rounded-lg border border-[var(--color-line)]
                              bg-[var(--color-paper)] px-3.5 py-2.5 text-[14px] hover:border-[var(--color-crimson)]">
                  {r.label}
                </a>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  )
}
