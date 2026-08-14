'use client'

import { useState, useMemo } from 'react'
import { scoreOrganisation } from '@/lib/quality'

type Cat = { id: number; slug: string; nameEn: string; parentId: number | null }
type Place = { id: number; label: string }
type Recent = { id: number; nameEn: string; slug: string; score: number; published: boolean }

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export function CaptureForm({
  categories, places, recent,
}: { categories: Cat[]; places: Place[]; recent: Recent[] }) {
  const [f, setF] = useState({
    nameEn: '', nameNe: '', categoryId: '', localLevelId: '', ward: '',
    addressEn: '', phone: '', whatsapp: '', website: '', facebook: '',
    descriptionEn: '', lat: '', lng: '', priceLevel: '',
    open: '08:00', close: '21:00', closedDay: '',
    sourceNote: '', photos: [] as string[],
  })
  const [busy, setBusy] = useState<string | null>(null)
  const [done, setDone] = useState<{ slug: string; published: boolean; score: number } | null>(null)
  const [placeQuery, setPlaceQuery] = useState('')

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }))

  const leaves = categories.filter((c) => c.parentId !== null)
  const matchedPlaces = useMemo(() => {
    const q = placeQuery.trim().toLowerCase()
    if (!q) return places.slice(0, 40)
    return places.filter((p) => p.label.toLowerCase().includes(q)).slice(0, 40)
  }, [placeQuery, places])

  // Live quality score — the operator sees exactly what is still missing.
  const quality = useMemo(() => scoreOrganisation({
    nameEn: f.nameEn, nameNe: f.nameNe,
    categoryId: f.categoryId ? Number(f.categoryId) : null,
    descriptionEn: f.descriptionEn,
    website: f.website, facebook: f.facebook,
    lat: f.lat ? Number(f.lat) : null, lng: f.lng ? Number(f.lng) : null,
    localLevelId: f.localLevelId ? Number(f.localLevelId) : null,
    ward: f.ward ? Number(f.ward) : null,
    phones: f.phone ? [f.phone] : [],
    hours: f.open && f.close ? { mon: [[f.open, f.close]] } : null,
    photoCount: f.photos.length,
    verifiedAt: new Date(),
  }), [f])

  function getGPS() {
    setBusy('gps')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setF((s) => ({
          ...s,
          lat: pos.coords.latitude.toFixed(6),
          lng: pos.coords.longitude.toFixed(6),
        }))
        setBusy(null)
      },
      () => { setBusy(null); alert('Could not get GPS. Type the coordinates or try again outside.') },
      { enableHighAccuracy: true, timeout: 12000 },
    )
  }

  async function addPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setBusy('photo')
    const out: string[] = []
    for (const file of files) out.push(await downscale(file))
    setF((s) => ({ ...s, photos: [...s.photos, ...out] }))
    setBusy(null)
  }

  async function submit(force = false) {
    setBusy('save')
    const res = await fetch('/api/capture', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...f, force }),
    })
    setBusy(null)

    // The name key is lossy on purpose, so a collision is a question, not a verdict.
    if (res.status === 409) {
      const j = await res.json()
      const again = confirm(
        `${j.message}\n\nAlready here: /biz/${j.slug}\n\n` +
        `OK = save this as a separate place anyway.\nCancel = stop, so you can check.`,
      )
      if (again) return submit(true)
      return
    }
    if (!res.ok) { alert('Save failed: ' + (await res.text())); return }
    const j = await res.json()
    setDone(j)
    setF((s) => ({
      ...s, nameEn: '', nameNe: '', addressEn: '', phone: '', whatsapp: '',
      website: '', facebook: '', descriptionEn: '', photos: [], sourceNote: '',
      // deliberately keep categoryId, localLevelId, lat/lng — you are usually
      // capturing several places in the same street in one sitting
    }))
  }

  const input = 'w-full h-12 px-3.5 rounded-xl border border-[--color-line] bg-[--color-surface] text-[16px]'
  const label = 'block text-[12px] uppercase tracking-wider text-[--color-ink-3] mb-1.5 mt-4'

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-32">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[22px] font-bold tracking-tight">Capture a place</h1>
        <a href="/capture/queue" className="text-[13px] text-[--color-ink-3] underline">Queue</a>
      </div>

      {done && (
        <div className="mt-4 rounded-xl border px-4 py-3 text-[14px]"
             style={{ borderColor: 'color-mix(in srgb, var(--color-verified) 40%, transparent)' }}>
          Saved — score {done.score}/100.{' '}
          {done.published
            ? <>It is <strong>live</strong>: <a className="underline" href={`/biz/${done.slug}`}>view page</a></>
            : <>Held back as a draft — it needs more before it can publish.</>}
        </div>
      )}

      {/* Score meter: the operator always knows how far from publishable they are. */}
      <div className="mt-5 rounded-xl border border-[--color-line] bg-[--color-surface] p-3.5">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[13px] text-[--color-ink-2]">Quality</span>
          <span className="text-[15px] font-semibold tabular-nums">
            {quality.score}<span className="text-[--color-ink-3] text-[13px]">/100</span>
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-[--color-surface-2] overflow-hidden">
          <div className="h-full rounded-full transition-all"
               style={{
                 width: `${quality.score}%`,
                 background: quality.publishable ? 'var(--color-verified)' : 'var(--color-crimson)',
               }} />
        </div>
        <p className="text-[12.5px] text-[--color-ink-3] mt-2">
          {quality.publishable
            ? 'Publishable — this will go live on save.'
            : `Still needed: ${quality.missing.slice(0, 4).join(', ')}`}
        </p>
      </div>

      <label className={label}>Name (English) *</label>
      <input className={input} value={f.nameEn} onChange={set('nameEn')} placeholder="Bajeko Sekuwa" />

      <label className={label}>Name (Nepali)</label>
      <input className={`${input} ne`} value={f.nameNe} onChange={set('nameNe')} placeholder="बजेको सेकुवा" />

      <label className={label}>Category *</label>
      <select className={input} value={f.categoryId} onChange={set('categoryId')}>
        <option value="">Choose…</option>
        {leaves.map((c) => <option key={c.id} value={c.id}>{c.nameEn}</option>)}
      </select>

      <label className={label}>Local level *</label>
      <input className={input} value={placeQuery} onChange={(e) => setPlaceQuery(e.target.value)}
             placeholder="Type to filter: Kathmandu, Pokhara…" />
      <select className={`${input} mt-2`} value={f.localLevelId} onChange={set('localLevelId')} size={1}>
        <option value="">Choose…</option>
        {matchedPlaces.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
      </select>

      <label className={label}>Ward</label>
      <input className={input} value={f.ward} onChange={set('ward')} inputMode="numeric" placeholder="7" />

      <label className={label}>Location *</label>
      <div className="flex gap-2">
        <button onClick={getGPS} disabled={busy === 'gps'}
                className="h-12 px-4 rounded-xl bg-[--color-crimson] text-white font-medium text-[15px] shrink-0">
          {busy === 'gps' ? 'Locating…' : 'Use GPS'}
        </button>
        <input className={input} value={f.lat} onChange={set('lat')} placeholder="lat" inputMode="decimal" />
        <input className={input} value={f.lng} onChange={set('lng')} placeholder="lng" inputMode="decimal" />
      </div>

      <label className={label}>Photos * <span className="normal-case text-[--color-ink-3]">— evidence, not decoration</span></label>
      <input type="file" accept="image/*" capture="environment" multiple onChange={addPhotos}
             className="block w-full text-[14px] file:h-11 file:px-4 file:mr-3 file:rounded-xl
                        file:border-0 file:bg-[--color-surface-2] file:text-[--color-ink] file:text-[14px]" />
      {f.photos.length > 0 && (
        <div className="flex gap-2 mt-2 overflow-x-auto">
          {f.photos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="" className="h-20 w-20 object-cover rounded-lg shrink-0" />
          ))}
        </div>
      )}

      <label className={label}>Phone</label>
      <input className={input} value={f.phone} onChange={set('phone')} inputMode="tel" placeholder="01-4441234 or 98…" />

      <label className={label}>WhatsApp</label>
      <input className={input} value={f.whatsapp} onChange={set('whatsapp')} inputMode="tel" placeholder="977…" />

      <label className={label}>Address</label>
      <input className={input} value={f.addressEn} onChange={set('addressEn')} placeholder="Thamel Marg, near…" />

      <label className={label}>Opening hours</label>
      <div className="flex gap-2 items-center">
        <input className={input} type="time" value={f.open} onChange={set('open')} />
        <span className="text-[--color-ink-3]">to</span>
        <input className={input} type="time" value={f.close} onChange={set('close')} />
      </div>
      <select className={`${input} mt-2`} value={f.closedDay} onChange={set('closedDay')}>
        <option value="">Open every day</option>
        {DAYS.map((d) => <option key={d} value={d}>Closed on {d}</option>)}
      </select>

      <label className={label}>What is it actually like? *</label>
      <textarea className="w-full min-h-28 p-3.5 rounded-xl border border-[--color-line]
                           bg-[--color-surface] text-[16px]"
                value={f.descriptionEn} onChange={set('descriptionEn')}
                placeholder="Two or three honest sentences. What they do well, what to order, who it suits. Write what you'd tell a friend — this is the part no scraper can copy." />
      <p className="text-[12px] text-[--color-ink-3] mt-1">{f.descriptionEn.length} chars · 200+ for full marks</p>

      <label className={label}>Website</label>
      <input className={input} value={f.website} onChange={set('website')} inputMode="url" />

      <label className={label}>Facebook page</label>
      <input className={input} value={f.facebook} onChange={set('facebook')} inputMode="url" />

      <label className={label}>Source note</label>
      <input className={input} value={f.sourceNote} onChange={set('sourceNote')}
             placeholder="Visited 12 Aug, spoke to owner Ram" />

      <div className="fixed bottom-0 inset-x-0 border-t border-[--color-line] bg-[--color-paper]/95
                      backdrop-blur px-4 py-3">
        <div className="mx-auto max-w-lg flex gap-3 items-center">
          <span className="text-[13px] text-[--color-ink-3] tabular-nums">{quality.score}/100</span>
          <button onClick={() => submit()} disabled={busy === 'save' || !f.nameEn}
                  className="flex-1 h-12 rounded-xl bg-[--color-crimson] text-white font-medium
                             text-[15px] disabled:opacity-40">
            {busy === 'save' ? 'Saving…' : quality.publishable ? 'Save & publish' : 'Save as draft'}
          </button>
        </div>
      </div>

      {recent.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[14px] font-semibold mb-2">Recently captured</h2>
          <ul className="text-[13.5px] divide-y divide-[--color-line] rounded-xl border border-[--color-line]">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-3.5 py-2">
                <a href={`/biz/${r.slug}`} className="truncate underline">{r.nameEn}</a>
                <span className="ml-auto tabular-nums text-[--color-ink-3]">{r.score}</span>
                <span className={r.published ? 'text-[--color-verified]' : 'text-[--color-ink-3]'}>
                  {r.published ? 'live' : 'draft'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

/**
 * Downscale in the browser before upload. Phone photos are 4–8 MB; on Nepali
 * mobile data that is the difference between capturing eight places in an
 * afternoon and giving up after two.
 */
function downscale(file: File, max = 1600, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}
