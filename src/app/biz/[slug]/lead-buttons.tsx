'use client'

import { useState } from 'react'

/**
 * Lead attribution, shipped in v0 rather than year 5.
 *
 * This is the whole commercial argument in one component: when you sit across
 * from an owner and say "37 people asked for your number last month", the
 * renewal is a decision about return, not goodwill. Without this the second
 * year's invoice does not get paid.
 *
 * We log the event kind and nothing about the person — no IP, no identifier,
 * no cross-site anything. Enough to prove value, not enough to track anyone.
 */
type Props = {
  orgId: number
  phones: string[]
  whatsapp: string | null
  website: string | null
  lat: number | null
  lng: number | null
}

function log(orgId: number, kind: string, surface = 'profile') {
  try {
    const body = JSON.stringify({ orgId, kind, surface })
    navigator.sendBeacon?.('/api/lead', new Blob([body], { type: 'application/json' }))
  } catch { /* never let analytics break a phone call */ }
}

export function LeadButtons({ orgId, phones, whatsapp, website, lat, lng }: Props) {
  const [revealed, setRevealed] = useState(false)
  const phone = phones[0]
  const btn =
    'inline-flex items-center gap-2 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] ' +
    'px-3.5 h-10 text-[14px] font-medium no-underline hover:border-[var(--color-crimson)] transition-colors'

  return (
    <div className="flex flex-wrap gap-2 mt-6">
      {phone && !revealed && (
        <button className={btn} onClick={() => { setRevealed(true); log(orgId, 'phone_reveal') }}>
          Show phone number
        </button>
      )}
      {phone && revealed && (
        <a className={btn} href={`tel:${phone.replace(/\s/g, '')}`} onClick={() => log(orgId, 'call_click')}>
          {phone}
        </a>
      )}
      {whatsapp && (
        <a className={btn} href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
           rel="noopener" onClick={() => log(orgId, 'whatsapp_click')}>
          WhatsApp
        </a>
      )}
      {lat != null && lng != null && (
        <a className={btn} href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
           rel="noopener nofollow" onClick={() => log(orgId, 'directions_click')}>
          Directions
        </a>
      )}
      {website && (
        <a className={btn} href={website} rel="noopener nofollow"
           onClick={() => log(orgId, 'website_click')}>
          Website
        </a>
      )}
    </div>
  )
}
