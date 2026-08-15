import Link from 'next/link'
import { db } from '@/db'
import {
  organisation, location, category, localLevel, district, province, searchLog, media,
  agency, service,
} from '@/db/schema'
import { eq, and, or, ilike, sql, desc } from 'drizzle-orm'
import { Container, EmptyState, ProvenanceChip } from '@/components/ui'
import { nameKey } from '@/lib/np'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Search', robots: { index: false, follow: true } }

/**
 * Postgres trigram + prefix matching, not Typesense. At a few hundred records
 * this is indistinguishable in quality and costs nothing to run. Swap it out at
 * ~50k records, not before — an extra service to operate is an extra service to
 * operate, and right now the constraint is field time, not query latency.
 */
export default async function Search({
  searchParams,
}: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? '').trim()
  if (!q) {
    return (
      <Container className="py-10">
        <h1 className="text-[24px] font-bold tracking-tight mb-4">Search</h1>
        <EmptyState title="Type something"
        body="Try a place, a kind of business, a government office, or a thing you need done — “passport”, “ward office lalitpur”, “जन्म दर्ता”." />
      </Container>
    )
  }

  const key = nameKey(q)
  const like = `%${q}%`

  const [orgs, places, agencies, services] = await Promise.all([
    db.select({
      slug: organisation.slug, nameEn: organisation.nameEn, nameNe: organisation.nameNe,
      verifiedAt: organisation.verifiedAt, verifiedBy: organisation.verifiedBy,
      catName: category.nameEn,
      placeName: localLevel.nameEn, districtName: district.nameEn,
      pSlug: province.slug, dSlug: district.slug, lSlug: localLevel.slug,
      photo: sql<string | null>`(select ${media.url} from ${media}
        where ${media.entityType}='organisation' and ${media.entityId}=${organisation.id}
        order by ${media.sort} limit 1)`,
    })
      .from(organisation)
      .leftJoin(location, and(eq(location.organisationId, organisation.id), eq(location.isPrimary, true)))
      .leftJoin(category, eq(category.id, organisation.categoryId))
      .leftJoin(localLevel, eq(localLevel.id, location.localLevelId))
      .leftJoin(district, eq(district.id, localLevel.districtId))
      .leftJoin(province, eq(province.id, district.provinceId))
      .where(and(
        eq(organisation.published, true),
        or(
          ilike(organisation.nameEn, like),
          ilike(organisation.nameNe, like),
          ilike(organisation.nameKey, `%${key}%`),
          ilike(category.nameEn, like),
        ),
      ))
      .orderBy(desc(organisation.qualityScore))
      .limit(30),

    db.select({
      nameEn: localLevel.nameEn, nameNe: localLevel.nameNe, wards: localLevel.wards,
      pSlug: province.slug, dSlug: district.slug, lSlug: localLevel.slug,
      districtName: district.nameEn,
    })
      .from(localLevel)
      .innerJoin(district, eq(district.id, localLevel.districtId))
      .innerJoin(province, eq(province.id, district.provinceId))
      .where(or(
        ilike(localLevel.nameEn, like),
        ilike(localLevel.nameNe, like),
        ilike(district.nameEn, like),
      ))
      .limit(20),

    // Government bodies. Unpublished ones still surface — someone searching for
    // a ministry should find our page saying "we haven't confirmed this yet"
    // rather than nothing at all.
    db.select({
      slug: agency.slug, nameEn: agency.nameEn, nameNe: agency.nameNe,
      kind: agency.kind, level: agency.level, status: agency.status,
      published: agency.published,
      districtName: district.nameEn,
    })
      .from(agency)
      .leftJoin(district, eq(district.id, agency.districtId))
      .where(or(
        ilike(agency.nameEn, like),
        ilike(agency.nameNe, like),
      ))
      .orderBy(desc(agency.published))
      .limit(12),

    db.select({
      slug: service.slug, nameEn: service.nameEn, nameNe: service.nameNe,
      summaryEn: service.summaryEn, published: service.published,
    })
      .from(service)
      .where(or(
        ilike(service.nameEn, like),
        ilike(service.nameNe, like),
        ilike(service.summaryEn, like),
      ))
      .limit(12),
  ])

  // Zero-result queries are the highest-signal roadmap input we have.
  const total = orgs.length + places.length + agencies.length + services.length
  await db.insert(searchLog).values({ q, qKey: key, results: total })

  return (
    <Container className="py-8">
      <h1 className="text-[22px] font-bold tracking-tight">
        {total} result{total === 1 ? '' : 's'} for “{q}”
      </h1>

      {services.length > 0 && (
        <section className="mt-7">
          <h2 className="text-[13px] uppercase tracking-wider text-[--color-ink-3] mb-2.5">
            How to do this
          </h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {services.map((s2) => (
              <li key={s2.slug}>
                <Link href={`/how-to/${s2.slug}`}
                  className="block no-underline rounded-lg border border-[--color-line]
                             bg-[--color-surface] px-3.5 py-2.5 hover:border-[--color-crimson] h-full">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-medium text-[14.5px]">{s2.nameEn}</span>
                    {s2.nameNe && <span className="ne text-[12.5px] text-[--color-ink-3]">{s2.nameNe}</span>}
                    {!s2.published && (
                      <span className="text-[10px] uppercase tracking-wider text-[--color-ink-3]
                                       border border-[--color-line] rounded-full px-2 py-0.5">draft</span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {agencies.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[13px] uppercase tracking-wider text-[--color-ink-3] mb-2.5">
            Government offices
          </h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {agencies.map((ag) => (
              <li key={ag.slug}>
                <Link href={`/gov/${ag.slug}`}
                  className="block no-underline rounded-lg border border-[--color-line]
                             bg-[--color-surface] px-3.5 py-2.5 hover:border-[--color-crimson] h-full">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-medium text-[14.5px]">{ag.nameEn}</span>
                    {ag.status !== 'active' && (
                      <span className="text-[10px] uppercase tracking-wider text-[--color-ink-3]
                                       border border-[--color-line] rounded-full px-2 py-0.5">
                        {ag.status}
                      </span>
                    )}
                  </div>
                  <div className="text-[12.5px] text-[--color-ink-3]">
                    {ag.nameNe && <span className="ne">{ag.nameNe}</span>}
                    {ag.districtName ? ` · ${ag.districtName}` : ''}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {places.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[13px] uppercase tracking-wider text-[--color-ink-3] mb-2.5">Places</h2>
          <ul className="grid sm:grid-cols-2 gap-2">
            {places.map((p) => (
              <li key={`${p.pSlug}/${p.dSlug}/${p.lSlug}`}>
                <Link href={`/nepal/${p.pSlug}/${p.dSlug}/${p.lSlug}`}
                  className="block no-underline rounded-lg border border-[--color-line]
                             bg-[--color-surface] px-3.5 py-2.5 hover:border-[--color-crimson]">
                  <div className="font-medium text-[14.5px]">{p.nameEn}</div>
                  <div className="text-[12.5px] text-[--color-ink-3]">
                    <span className="ne">{p.nameNe}</span> · {p.districtName} · {p.wards} wards
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {orgs.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[13px] uppercase tracking-wider text-[--color-ink-3] mb-2.5">Verified places</h2>
          <ul className="grid sm:grid-cols-2 gap-3">
            {orgs.map((o) => (
              <li key={o.slug}>
                <Link href={`/biz/${o.slug}`}
                  className="flex gap-3 no-underline rounded-xl border border-[--color-line]
                             bg-[--color-surface] p-3 hover:border-[--color-crimson] h-full">
                  {o.photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.photo} alt="" width={64} height={64} loading="lazy"
                         className="w-16 h-16 rounded-lg object-cover bg-[--color-surface-2] shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-[15px] leading-snug">{o.nameEn}</div>
                    <div className="text-[12.5px] text-[--color-ink-3]">
                      {o.catName} · {o.placeName}
                    </div>
                    <div className="mt-1.5">
                      <ProvenanceChip verifiedAt={o.verifiedAt} verifiedBy={o.verifiedBy} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {total === 0 && (
        <div className="mt-8">
          <EmptyState
            title={`Nothing for “${q}” yet`}
            body="We have logged this search. Gaps in what people look for are how we decide where to go next — this query just became a to-do."
          />
        </div>
      )}
    </Container>
  )
}
