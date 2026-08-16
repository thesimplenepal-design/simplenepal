import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/db'
import {
  agency, agencyOffice, service, serviceAgency, localLevel, district, province,
  fact, source,
} from '@/db/schema'
import { eq, and, asc, sql } from 'drizzle-orm'
import { Container, Breadcrumbs, Stat, EmptyState } from '@/components/ui'
import { OpenToday } from '@/components/open-today'
import { currentSchedule, upcomingHolidays } from '@/db/hours'
import { holdersFor } from '@/db/directory'
import { evaluateOpen } from '@/lib/hours'
import { abs } from '@/lib/site'

export const revalidate = 3600

const KIND_LABEL: Record<string, string> = {
  ministry: 'Ministry', department: 'Department', authority: 'Authority',
  office: 'Office', commission: 'Commission', ward_office: 'Ward office',
}

async function load(slug: string) {
  const [a] = await db.select().from(agency).where(eq(agency.slug, slug))
  if (!a) return null

  const [parent] = a.parentId
    ? await db.select({ slug: agency.slug, nameEn: agency.nameEn })
        .from(agency).where(eq(agency.id, a.parentId))
    : [null]

  const [successor] = a.succeededById
    ? await db.select({ slug: agency.slug, nameEn: agency.nameEn })
        .from(agency).where(eq(agency.id, a.succeededById))
    : [null]

  const children = await db
    .select({ slug: agency.slug, nameEn: agency.nameEn, nameNe: agency.nameNe, kind: agency.kind })
    .from(agency).where(eq(agency.parentId, a.id)).orderBy(asc(agency.sort))

  const services = await db
    .select({ slug: service.slug, nameEn: service.nameEn, nameNe: service.nameNe,
              published: service.published, role: serviceAgency.role })
    .from(serviceAgency)
    .innerJoin(service, eq(service.id, serviceAgency.serviceId))
    .where(eq(serviceAgency.agencyId, a.id))

  const offices = await db
    .select({
      id: agencyOffice.id, addressEn: agencyOffice.addressEn, phones: agencyOffice.phones,
      localName: localLevel.nameEn, districtName: district.nameEn,
      pSlug: province.slug, dSlug: district.slug, lSlug: localLevel.slug,
    })
    .from(agencyOffice)
    .leftJoin(localLevel, eq(localLevel.id, agencyOffice.localLevelId))
    .leftJoin(district, eq(district.id, localLevel.districtId))
    .leftJoin(province, eq(province.id, district.provinceId))
    .where(eq(agencyOffice.agencyId, a.id))
    .limit(50)

  const holders = await holdersFor(a.id)

  const facts = await db
    .select({ field: fact.field, note: fact.note, confidence: fact.confidence,
              label: source.label, url: source.url })
    .from(fact).leftJoin(source, eq(source.id, fact.sourceId))
    .where(and(eq(fact.entityType, 'agency'), eq(fact.entityId, a.id)))

  // Only bodies with a public counter need an open/closed banner; a ministry
  // headquarters is not somewhere a citizen turns up to file a form.
  const servesPublic = offices.length > 0 && a.status === 'active'
  const [schedule, holidays] = servesPublic
    ? await Promise.all([currentSchedule(), upcomingHolidays()])
    : [null, []]

  return { a, parent, successor, children, services, offices, facts, schedule, holidays, holders }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await load((await params).slug)
  if (!data) return {}
  const { a } = data
  return {
    title: `${a.nameEn}${a.nameNe ? ` (${a.nameNe})` : ''}`,
    description: a.descriptionEn ??
      `${a.nameEn} — part of the Government of Nepal. What it does, its offices, and the services it delivers.`,
    alternates: { canonical: `/gov/${a.slug}` },
    // Not confirmed against an authoritative source → keep it out of the index.
    robots: a.published ? undefined : { index: false, follow: true },
  }
}

export default async function AgencyPage({ params }: { params: Promise<{ slug: string }> }) {
  const data = await load((await params).slug)
  if (!data) notFound()
  const { a, parent, successor, children, services, offices, facts, schedule, holidays, holders } = data
  const openState = evaluateOpen(schedule, holidays)
  const merged = a.status === 'merged' || a.status === 'abolished'

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'GovernmentOrganization',
    name: a.nameEn,
    alternateName: a.nameNe ?? undefined,
    url: abs(`/gov/${a.slug}`),
    sameAs: a.website ?? undefined,
    parentOrganization: parent ? { '@type': 'GovernmentOrganization', name: parent.nameEn } : undefined,
  }

  return (
    <Container className="py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <Breadcrumbs items={[
        { href: '/', label: 'Nepal' },
        { href: '/gov', label: 'Government' },
        ...(parent ? [{ href: `/gov/${parent.slug}`, label: parent.nameEn }] : []),
        { label: a.nameEn },
      ]} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[29px] font-bold tracking-tight leading-tight max-w-2xl">{a.nameEn}</h1>
          {a.nameNe && <p className="ne text-[var(--color-ink-2)] text-[17px] mt-1">{a.nameNe}</p>}
          <p className="text-[13px] text-[var(--color-ink-3)] mt-1.5">
            {KIND_LABEL[a.kind]} · {a.level === 'federal' ? 'Federal' : a.level === 'local' ? 'Local government' : a.level}
          </p>
        </div>
      </div>

      {openState && schedule && <OpenToday state={openState} schedule={schedule} />}

      {merged && (
        <div className="mt-5 rounded-xl border-l-[3px] border-l-[var(--color-crimson)] bg-[var(--color-crimson-soft)]
                        border border-[var(--color-line)] px-4 py-3">
          <p className="text-[14px] text-[var(--color-ink)] mb-0">
            <strong>This body no longer exists.</strong> {a.successionNote}{' '}
            {successor && (
              <>Its work is now at <Link href={`/gov/${successor.slug}`} className="underline">
                {successor.nameEn}</Link>.</>
            )}
          </p>
        </div>
      )}

      {!a.published && !merged && (
        <div className="mt-5 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3">
          <p className="text-[13.5px] text-[var(--color-ink-2)] mb-0">
            <strong className="text-[var(--color-ink)]">Not yet confirmed.</strong> This entry comes from the
            source listed below and has not been checked against the Nepal Gazette or the body&rsquo;s own
            publications. We&rsquo;d rather show you that than pretend.
          </p>
        </div>
      )}

      {a.descriptionEn && (
        <p className="mt-6 text-[15.5px] text-[var(--color-ink-2)] max-w-2xl leading-relaxed">{a.descriptionEn}</p>
      )}

      {a.website && (
        <p className="text-[13.5px] mt-5">
          Official site:{' '}
          <a href={a.website} rel="nofollow noopener" className="underline">{a.website.replace(/^https?:\/\//, '')}</a>
        </p>
      )}

      {holders.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[18px] font-semibold tracking-tight mb-1">Who to ask for</h2>
          <p className="text-[13px] text-[var(--color-ink-3)] mb-3 max-w-2xl">
            The office, and who currently holds it. People move — if this is out of date,{' '}
            <a href={`mailto:fix@simplenepal.com?subject=Officeholder: ${encodeURIComponent(a.nameEn)}`}
               className="underline">tell us</a>.
          </p>
          <ul className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]
                         divide-y divide-[var(--color-line)]">
            {holders.map((h, i) => (
              <li key={i} className="px-4 py-3">
                {/* Role first, person second. The office is the durable thing;
                    the person is an attribute of it with dates. */}
                <div className="text-[14.5px] font-medium">
                  {h.roleEn}
                  {h.roleNe && <span className="ne text-[13px] text-[var(--color-ink-3)] ml-2">{h.roleNe}</span>}
                </div>
                <div className="text-[13.5px] text-[var(--color-ink-2)] mt-0.5">
                  {h.personName ?? <span className="text-[var(--color-ink-3)]">Post vacant, as far as we know</span>}
                  {h.fromDate && <span className="text-[var(--color-ink-3)]"> · since {h.fromDate}</span>}
                </div>
                {h.contactPublic && (
                  <div className="text-[13px] mt-1">
                    <a href={`tel:${h.contactPublic.replace(/\s/g, '')}`} className="underline">
                      {h.contactPublic}
                    </a>
                  </div>
                )}
                <div className="text-[11.5px] text-[var(--color-ink-3)] mt-1">
                  {h.sourceUrl
                    ? <a href={h.sourceUrl} rel="nofollow noopener" className="underline">{h.sourceLabel}</a>
                    : h.sourceLabel ?? 'source not recorded'}
                  {' · '}confidence {h.confidence}%
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {children.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[18px] font-semibold tracking-tight mb-3">
            Departments and bodies under it
          </h2>
          <ul className="grid sm:grid-cols-2 gap-2.5">
            {children.map((ch) => (
              <li key={ch.slug}>
                <Link href={`/gov/${ch.slug}`}
                  className="block no-underline rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]
                             px-3.5 py-2.5 hover:border-[var(--color-crimson)] transition-colors">
                  <div className="font-medium text-[14px]">{ch.nameEn}</div>
                  {ch.nameNe && <div className="ne text-[12.5px] text-[var(--color-ink-3)]">{ch.nameNe}</div>}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {services.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[18px] font-semibold tracking-tight mb-3">Services it delivers</h2>
          <ul className="space-y-2">
            {services.map((s) => (
              <li key={s.slug}>
                <Link href={`/how-to/${s.slug}`}
                  className="flex items-baseline gap-3 no-underline rounded-xl border border-[var(--color-line)]
                             bg-[var(--color-surface)] px-3.5 py-2.5 hover:border-[var(--color-crimson)]">
                  <span className="font-medium text-[14.5px]">{s.nameEn}</span>
                  {s.nameNe && <span className="ne text-[13px] text-[var(--color-ink-3)]">{s.nameNe}</span>}
                  <span className="ml-auto text-[11.5px] text-[var(--color-ink-3)] uppercase tracking-wider">
                    {s.role}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {offices.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[18px] font-semibold tracking-tight mb-3">
            {offices.length === 1 ? 'Office' : `Offices (${offices.length})`}
          </h2>
          <ul className="grid sm:grid-cols-2 gap-2.5">
            {offices.map((o) => (
              <li key={o.id} className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3.5 py-2.5">
                <div className="text-[14px] font-medium">
                  {o.localName ?? 'Office'}{o.districtName ? `, ${o.districtName}` : ''}
                </div>
                {o.addressEn && <div className="text-[12.5px] text-[var(--color-ink-3)]">{o.addressEn}</div>}
                {o.phones?.length ? (
                  <div className="text-[12.5px] text-[var(--color-ink-2)] mt-0.5">{o.phones.join(' · ')}</div>
                ) : null}
                {o.pSlug && o.dSlug && o.lSlug && (
                  <Link href={`/nepal/${o.pSlug}/${o.dSlug}/${o.lSlug}`}
                        className="text-[12.5px] underline mt-1 inline-block">
                    About this place
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {children.length === 0 && services.length === 0 && offices.length === 0 && (
        <div className="mt-8">
          <EmptyState
            title="We haven't mapped this one yet"
            body="Its departments, offices and services aren't recorded here so far. We add a body when a service or an office actually needs it, rather than filling the site with empty pages."
          />
        </div>
      )}

      {facts.length > 0 && (
        <section className="mt-12">
          <h2 className="text-[15px] font-semibold tracking-tight mb-2">How we know this</h2>
          <ul className="text-[13px] rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]
                         divide-y divide-[var(--color-line)]">
            {facts.map((f, i) => (
              <li key={i} className="px-3.5 py-2.5">
                <div className="flex flex-wrap gap-x-3 gap-y-1 items-baseline">
                  <span className="font-mono text-[11.5px] text-[var(--color-ink-3)] w-20 shrink-0">{f.field}</span>
                  <span className="text-[var(--color-ink-2)] min-w-0">
                    {f.url ? <a href={f.url} className="underline" rel="nofollow noopener">{f.label}</a> : f.label}
                  </span>
                  <span className="ml-auto text-[11.5px] text-[var(--color-ink-3)] shrink-0">
                    confidence {f.confidence}%
                  </span>
                </div>
                {f.note && <p className="text-[12.5px] text-[var(--color-ink-3)] mt-1 mb-0">{f.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  )
}
