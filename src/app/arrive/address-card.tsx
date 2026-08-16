'use client'

import { useState } from 'react'
import { toDevanagari } from '@/lib/np'

/**
 * Write your address in Devanagari and hold it up.
 *
 * A visitor's most common stuck moment is standing in front of a driver who
 * cannot read the Latin name of their guesthouse. Both people want the same
 * thing and neither can get there. This is a very small tool for a very common
 * bad ten minutes.
 *
 * It transliterates by sound, so it produces something a Nepali speaker can
 * READ ALOUD and recognise — not a certified translation. The card says that,
 * because a tool that overstates itself is worse than one that admits its
 * limits.
 */
export function AddressCard() {
  const [name, setName] = useState('')
  const [area, setArea] = useState('')
  const [phone, setPhone] = useState('')

  const joined = [name.trim(), area.trim()].filter(Boolean).join(', ')
  const { text: ne, exact } = toDevanagari(joined)
  const hasAny = joined.length > 0

  const field =
    'w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-3 ' +
    'text-[16px] focus:outline-none focus:border-[var(--color-crimson)]'

  return (
    <div className="mt-6 max-w-2xl">
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-[12px] uppercase tracking-wider text-[var(--color-ink-3)] mb-1.5">
            Where you are staying
          </span>
          <input className={field} value={name} placeholder="Hotel Ganesh Himal"
                 onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="block">
          <span className="block text-[12px] uppercase tracking-wider text-[var(--color-ink-3)] mb-1.5">
            Area
          </span>
          <input className={field} value={area} placeholder="Thamel, Kathmandu"
                 onChange={(e) => setArea(e.target.value)} />
        </label>
      </div>
      <label className="block mt-3">
        <span className="block text-[12px] uppercase tracking-wider text-[var(--color-ink-3)] mb-1.5">
          Phone number <span className="normal-case tracking-normal">(optional)</span>
        </span>
        <input className={`${field} sm:max-w-xs tabular-nums`} value={phone} inputMode="tel"
               placeholder="+977 …" onChange={(e) => setPhone(e.target.value)} />
      </label>

      {hasAny && (
        <div className="mt-6 rounded-2xl border-2 border-[var(--color-ink)] bg-[var(--color-surface)] p-6">
          <div className="text-[11.5px] uppercase tracking-wider text-[var(--color-ink-3)] mb-2">
            मलाई यहाँ लानुहोस् · Please take me here
          </div>
          {/* Large, because it is read at arm's length through a car window. */}
          <div className="ne text-[30px] sm:text-[34px] font-semibold leading-tight break-words">
            {ne}
          </div>
          <div className="text-[17px] text-[var(--color-ink-2)] mt-3 break-words">
            {[name, area].filter(Boolean).join(', ')}
          </div>
          {phone && (
            <div className="text-[20px] font-medium tabular-nums mt-3">
              <a href={`tel:${phone.replace(/\s/g, '')}`} className="no-underline">{phone}</a>
            </div>
          )}
        </div>
      )}

      {hasAny && (
        <p className="text-[12.5px] text-[var(--color-ink-3)] mt-3">
          {exact
            ? 'Every place name here is one we have checked, so the Nepali spelling is right.'
            : 'Some of this is spelled the way it sounds rather than from a checked spelling — a driver can read it aloud and recognise it, but it is an approximation.'}{' '}
          If your hotel gives you a card with its own Nepali name, that one is better.{' '}
          <strong className="text-[var(--color-ink-2)]">Screenshot this before you land</strong>,
          while you still have data.
        </p>
      )}
    </div>
  )
}
