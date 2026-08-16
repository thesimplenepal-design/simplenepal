import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/db'
import {
  service, serviceStep, serviceDocument, serviceAgency, agency, fact, source,
} from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { Container, Breadcrumbs } from '@/components/ui'
import { abs } from '@/lib/site'
import { FindMyOffice } from './find-my-office'

export const revalidate = 3600

async function load(slug: string) {
  const [s] = await db.select().from(service).where(eq(service.slug, slug))
  if (!s) return null

  const [steps, docs, agencies, facts, feeSource] = await Promise.all([
    db.select().from(serviceStep).where(eq(serviceStep.serviceId, s.id)).orderBy(asc(serviceStep.position)),
    db.select().from(serviceDocument).where(eq(serviceDocument.serviceId, s.id)).orderBy(asc(serviceDocument.position)),
    db.select({ slug: agency.slug, nameEn: agency.nameEn, nameNe: agency.nameNe, role: serviceAgency.role })
      .from(serviceAgency).innerJoin(agency, eq(agency.id, serviceAgency.agencyId))
      .where(eq(serviceAgency.serviceId, s.id)),
    db.select({ field: fact.field, note: fact.note, confidence: fact.confidence,
                label: source.label, url: source.url })
      .from(fact).leftJoin(source, eq(source.id, fact.sourceId))
      .where(and(eq(fact.entityType, 'service'), eq(fact.entityId, s.id))),
    s.feeSourceId
      ? db.select().from(source).where(eq(source.id, s.feeSourceId))
      : Promise.resolve([]),
  ])

  return { s, steps, docs, agencies, facts, feeSource: feeSource[0] ?? null }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await load((await params).slug)
  if (!data) return {}
  const { s } = data
  return {
    title: `${s.nameEn}${s.nameNe ? ` — ${s.nameNe}` : ''}: steps, documents and fee`,
    description: (s.summaryEn ?? '').slice(0, 155),
    alternates: { canonical: `/how-to/${s.slug}` },
    robots: s.published ? undefined : { index: false, follow: true },
  }
}

export default async function ServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const data = await load((await params).slug)
  if (!data) notFound()
  const { s, steps, docs, agencies, facts, feeSource } = data

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'GovernmentService',
    name: s.nameEn,
    alternateName: s.nameNe ?? undefined,
    description: s.summaryEn ?? undefined,
    serviceType: s.category,
    url: abs(`/how-to/${s.slug}`),
    provider: agencies[0] ? { '@type': 'GovernmentOrganization', name: agencies[0].nameEn } : undefined,
    areaServed: { '@type': 'Country', name: 'Nepal' },
  }

  return (
    <Container className="py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <Breadcrumbs items={[
        { href: '/', label: 'Nepal' },
        { href: '/how-to', label: 'How to' },
        { label: s.nameEn },
      ]} />

      <h1 className="text-[30px] font-bold tracking-tight leading-tight max-w-2xl">{s.nameEn}</h1>
      {s.nameNe && <p className="ne text-[var(--color-ink-2)] text-[18px] mt-1">{s.nameNe}</p>}

      {!s.published && (
        <div className="mt-5 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3">
          <p className="text-[13.5px] text-[var(--color-ink-2)] mb-0">
            <strong className="text-[var(--color-ink)]">Draft — not yet confirmed at a counter.</strong>{' '}
            The steps below follow the official procedure, but nobody has walked through this at a real
            ward office for us yet. Treat it as a guide, not gospel, and check the sources at the bottom.
          </p>
        </div>
      )}

      {s.summaryEn && (
        <p className="mt-6 text-[16px] leading-relaxed text-[var(--color-ink-2)] max-w-2xl">{s.summaryEn}</p>
      )}

      {/* The four facts people actually came for */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-7">
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
          <div className="text-[20px] font-semibold tracking-tight">
            {s.feeAmount === 0
              ? 'Free'
              : s.feeAmount
                ? `${s.feeIsFrom ? 'From ' : ''}${s.feeCurrency} ${s.feeAmount.toLocaleString()}`
                : '—'}
          </div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)] mt-1">Fee</div>
        </div>
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
          <div className="text-[15px] font-semibold leading-tight">{s.durationTypical ?? '—'}</div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)] mt-1">How long</div>
        </div>
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
          <div className="text-[15px] font-semibold leading-tight">{docs.length} document{docs.length === 1 ? '' : 's'}</div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)] mt-1">To bring</div>
        </div>
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
          <div className="text-[15px] font-semibold leading-tight">
            {s.onlineUrl ? 'Yes' : 'In person'}
          </div>
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)] mt-1">Online?</div>
        </div>
      </div>

      {s.feeNote && (
        <p className="text-[13px] text-[var(--color-ink-2)] mt-3 max-w-2xl">
          {s.feeNote}
          {feeSource && (
            <> <span className="text-[var(--color-ink-3)]">— source: {feeSource.url
              ? <a href={feeSource.url} className="underline" rel="nofollow noopener">{feeSource.label}</a>
              : feeSource.label}</span></>
          )}
        </p>
      )}

      <FindMyOffice serviceSlug={s.slug} />

      {docs.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[19px] font-semibold tracking-tight mb-3">What to bring</h2>
          <ul className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] divide-y divide-[var(--color-line)]">
            {docs.map((d) => (
              <li key={d.id} className="px-4 py-3">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[14.5px] font-medium">{d.nameEn}</span>
                  {d.nameNe && <span className="ne text-[13px] text-[var(--color-ink-3)]">{d.nameNe}</span>}
                  {!d.required && (
                    <span className="text-[10.5px] uppercase tracking-wider text-[var(--color-ink-3)]
                                     border border-[var(--color-line)] rounded-full px-2 py-0.5">
                      if applicable
                    </span>
                  )}
                </div>
                {d.note && <p className="text-[13px] text-[var(--color-ink-2)] mt-1 mb-0">{d.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {steps.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[19px] font-semibold tracking-tight mb-3">Step by step</h2>
          <ol className="space-y-3 list-none pl-0">
            {steps.map((st) => (
              <li key={st.id} className="flex gap-3.5">
                <span className="shrink-0 w-7 h-7 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-line)]
                                 text-[13px] font-semibold grid place-items-center mt-0.5">
                  {st.position}
                </span>
                <div className="min-w-0">
                  <div className="text-[15.5px] font-medium leading-snug">{st.titleEn}</div>
                  {st.titleNe && <div className="ne text-[13.5px] text-[var(--color-ink-3)]">{st.titleNe}</div>}
                  {st.detailEn && (
                    <p className="text-[14px] text-[var(--color-ink-2)] mt-1 mb-0 leading-relaxed">{st.detailEn}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {s.eligibilityEn && (
        <section className="mt-10">
          <h2 className="text-[17px] font-semibold tracking-tight mb-2">Who can apply</h2>
          <p className="text-[14.5px] text-[var(--color-ink-2)] max-w-2xl mb-0">{s.eligibilityEn}</p>
        </section>
      )}

      {agencies.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[17px] font-semibold tracking-tight mb-3">Who runs this</h2>
          <ul className="flex flex-wrap gap-2">
            {agencies.map((ag) => (
              <li key={ag.slug}>
                <Link href={`/gov/${ag.slug}`}
                  className="inline-block no-underline rounded-lg border border-[var(--color-line)]
                             bg-[var(--color-surface)] px-3 py-2 text-[13.5px] hover:border-[var(--color-crimson)]">
                  {ag.nameEn}
                  <span className="text-[var(--color-ink-3)] text-[11.5px] uppercase tracking-wider ml-2">{ag.role}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {s.legalBasis && (
        <p className="text-[13px] text-[var(--color-ink-3)] mt-8">Legal basis: {s.legalBasis}</p>
      )}

      {facts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[15px] font-semibold tracking-tight mb-2">How we know this</h2>
          <ul className="text-[13px] rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]
                         divide-y divide-[var(--color-line)]">
            {facts.map((f, i) => (
              <li key={i} className="px-3.5 py-2.5">
                <div className="flex flex-wrap gap-x-3 gap-y-1 items-baseline">
                  <span className="font-mono text-[11.5px] text-[var(--color-ink-3)] w-16 shrink-0">{f.field}</span>
                  <span className="text-[var(--color-ink-2)] min-w-0">
                    {f.url ? <a href={f.url} className="underline" rel="nofollow noopener">{f.label}</a> : f.label}
                  </span>
                  <span className="ml-auto text-[11.5px] text-[var(--color-ink-3)] shrink-0">confidence {f.confidence}%</span>
                </div>
                {f.note && <p className="text-[12.5px] text-[var(--color-ink-3)] mt-1 mb-0">{f.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 max-w-2xl">
        <h3 className="text-[15px] font-semibold mb-1.5">We are not the government</h3>
        <p className="text-[13.5px] text-[var(--color-ink-2)] mb-0">
          Procedures and fees change, sometimes without notice. Everything here shows when we last checked
          and where. <strong>Confirm before you travel</strong> — and if something is wrong,{' '}
          <a href={`mailto:fix@simplenepal.com?subject=Correction: ${encodeURIComponent(s.nameEn)}`}
             className="underline">tell us</a> and we&rsquo;ll fix it the same day.
        </p>
      </div>
    </Container>
  )
}
