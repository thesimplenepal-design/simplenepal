import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/db'
import { province, district, localLevel, organisation, location, category, media } from '@/db/schema'
import { eq, and, asc, desc, sql } from 'drizzle-orm'
import { Container, Breadcrumbs, Stat, EmptyState, KIND_LABEL, ProvenanceChip } from '@/components/ui'
import { abs } from '@/lib/site'

export const revalidate = 3600

async function load(pSlug: string, dSlug: string, lSlug: string) {
  const [row] = await db
    .select({ p: province, d: district, l: localLevel })
    .from(localLevel)
    .innerJoin(district, eq(district.id, localLevel.districtId))
    .innerJoin(province, eq(province.id, district.provinceId))
    .where(and(eq(province.slug, pSlug), eq(district.slug, dSlug), eq(localLevel.slug, lSlug)))
  if (!row) return null

  const orgs = await db
    .select({
      id: organisation.id, slug: organisation.slug, nameEn: organisation.nameEn,
      nameNe: organisation.nameNe, description: organisation.descriptionEn,
      verifiedAt: organisation.verifiedAt, verifiedBy: organisation.verifiedBy,
      score: organisation.qualityScore,
      catName: category.nameEn, catSlug: category.slug,
      ward: location.ward,
      photo: sql<string | null>`(
        select ${media.url} from ${media}
        where ${media.entityType} = 'organisation' and ${media.entityId} = ${organisation.id}
        order by ${media.sort} limit 1)`,
    })
    .from(organisation)
    .innerJoin(location, eq(location.organisationId, organisation.id))
    .leftJoin(category, eq(category.id, organisation.categoryId))
    .where(and(eq(location.localLevelId, row.l.id), eq(organisation.published, true)))
    .orderBy(desc(organisation.qualityScore))

  return { ...row, orgs }
}

export async function generateMetadata(
  { params }: { params: Promise<{ province: string; district: string; local: string }> },
): Promise<Metadata> {
  const { province: p, district: d, local: l } = await params
  const data = await load(p, d, l)
  if (!data) return {}
  const kind = KIND_LABEL[data.l.kind].en
  return {
    title: `${data.l.nameEn} ${kind} — ${data.d.nameEn}, ${data.p.nameEn}`,
    description:
      `${data.l.nameEn} (${data.l.nameNe}) is a ${kind.toLowerCase()} in ${data.d.nameEn} District, ` +
      `${data.p.nameEn}, with ${data.l.wards} wards.` +
      (data.orgs.length ? ` ${data.orgs.length} verified places listed.` : ''),
    alternates: { canonical: `/nepal/${p}/${d}/${l}` },
    // A hub with no verified places yet is still useful to a human, but it is
    // thin for a search engine. Keep it out of the index until it has substance.
    robots: data.orgs.length === 0 ? { index: false, follow: true } : undefined,
  }
}

export default async function LocalLevelPage(
  { params }: { params: Promise<{ province: string; district: string; local: string }> },
) {
  const { province: pSlug, district: dSlug, local: lSlug } = await params
  const data = await load(pSlug, dSlug, lSlug)
  if (!data) notFound()
  const { p, d, l, orgs } = data
  const kind = KIND_LABEL[l.kind]

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'AdministrativeArea',
    name: l.nameEn,
    alternateName: l.nameNe,
    containedInPlace: { '@type': 'AdministrativeArea', name: `${d.nameEn} District` },
    url: abs(`/nepal/${p.slug}/${d.slug}/${l.slug}`),
  }

  return (
    <Container className="py-8">
      <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <Breadcrumbs items={[
        { href: '/', label: 'Nepal' },
        { href: `/nepal/${p.slug}`, label: p.nameEn },
        { href: `/nepal/${p.slug}/${d.slug}`, label: `${d.nameEn} District` },
        { label: l.nameEn },
      ]} />

      <h1 className="text-[30px] font-bold tracking-tight leading-tight">{l.nameEn}</h1>
      <div className="flex flex-wrap items-baseline gap-x-3 mt-1">
        <span className="ne text-[var(--color-ink-2)] text-[17px]">{l.nameNe}</span>
        <span className="text-[13px] text-[var(--color-ink-3)]">
          {kind.en} <span className="ne">· {kind.ne}</span>
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
        <Stat label="Wards" value={l.wards} />
        <Stat label="District" value={<span className="text-[16px]">{d.nameEn}</span>} />
        <Stat label="Province" value={<span className="text-[16px]">{p.nameEn}</span>} />
        <Stat label="Verified places" value={orgs.length} />
      </div>

      {l.introEn && <p className="mt-6 text-[15.5px] text-[var(--color-ink-2)] max-w-2xl leading-relaxed">{l.introEn}</p>}

      {l.website && (
        <p className="text-[13px] text-[var(--color-ink-3)] mt-3">
          Official site: <a href={l.website} className="underline" rel="nofollow noopener">{l.website}</a>
        </p>
      )}

      <h2 className="text-[19px] font-semibold tracking-tight mt-10 mb-4">Places we have checked</h2>

      {orgs.length === 0 ? (
        <EmptyState
          title="Nothing verified here yet"
          body={<>We only publish places someone has physically visited, photographed and confirmed.
            Nobody has been to {l.nameEn} for us yet — so this page is honest about being empty
            rather than padded with scraped listings.</>}
        />
      ) : (
        <ul className="grid sm:grid-cols-2 gap-3">
          {orgs.map((o) => (
            <li key={o.id}>
              <Link href={`/biz/${o.slug}`}
                className="flex gap-3 no-underline rounded-xl border border-[var(--color-line)]
                           bg-[var(--color-surface)] p-3 hover:border-[var(--color-crimson)] transition-colors h-full">
                {o.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={o.photo} alt="" width={72} height={72} loading="lazy"
                       className="w-[72px] h-[72px] rounded-lg object-cover bg-[var(--color-surface-2)] shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-medium text-[15px] leading-snug">{o.nameEn}</div>
                  <div className="text-[12.5px] text-[var(--color-ink-3)] mt-0.5">
                    {o.catName}{o.ward ? ` · Ward ${o.ward}` : ''}
                  </div>
                  <div className="mt-1.5">
                    <ProvenanceChip verifiedAt={o.verifiedAt} verifiedBy={o.verifiedBy} />
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  )
}
