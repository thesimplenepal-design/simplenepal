import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/db'
import {
  organisation, location, category, media, fact, source,
  localLevel, district, province,
} from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { Container, Breadcrumbs, ProvenanceChip } from '@/components/ui'
import { LeadButtons } from './lead-buttons'

export const revalidate = 3600

async function load(slug: string) {
  const [row] = await db
    .select({ o: organisation, loc: location, cat: category, l: localLevel, d: district, p: province })
    .from(organisation)
    .leftJoin(location, and(eq(location.organisationId, organisation.id), eq(location.isPrimary, true)))
    .leftJoin(category, eq(category.id, organisation.categoryId))
    .leftJoin(localLevel, eq(localLevel.id, location.localLevelId))
    .leftJoin(district, eq(district.id, localLevel.districtId))
    .leftJoin(province, eq(province.id, district.provinceId))
    .where(eq(organisation.slug, slug))
  if (!row || !row.o.published) return null

  const [photos, facts] = await Promise.all([
    db.select().from(media)
      .where(and(eq(media.entityType, 'organisation'), eq(media.entityId, row.o.id)))
      .orderBy(asc(media.sort)),
    db.select({ field: fact.field, verifiedAt: fact.verifiedAt, verifiedBy: fact.verifiedBy,
                label: source.label, kind: source.kind })
      .from(fact).leftJoin(source, eq(source.id, fact.sourceId))
      .where(and(eq(fact.entityType, 'organisation'), eq(fact.entityId, row.o.id))),
  ])
  return { ...row, photos, facts }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const data = await load((await params).slug)
  if (!data) return {}
  const { o, cat, l, d } = data
  const where = l ? `${l.nameEn}, ${d?.nameEn}` : 'Nepal'
  return {
    title: `${o.nameEn} — ${cat?.nameEn ?? 'Place'} in ${where}`,
    description: (o.descriptionEn ?? '').slice(0, 155) ||
      `${o.nameEn} is a ${cat?.nameEn?.toLowerCase() ?? 'place'} in ${where}. Verified in person by SimpleNepal.`,
    alternates: { canonical: `/biz/${o.slug}` },
    openGraph: { images: data.photos[0]?.url ? [data.photos[0].url] : undefined },
  }
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABEL: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday',
  fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}

export default async function BizPage({ params }: { params: Promise<{ slug: string }> }) {
  const data = await load((await params).slug)
  if (!data) notFound()
  const { o, loc, cat, l, d, p, photos, facts } = data

  const hours = (loc?.hours ?? null) as Record<string, [string, string][]> | null

  const ld = {
    '@context': 'https://schema.org',
    '@type': cat?.schemaType ?? 'LocalBusiness',
    name: o.nameEn,
    alternateName: o.nameNe ?? undefined,
    description: o.descriptionEn ?? undefined,
    image: photos.map((ph) => ph.url),
    telephone: loc?.phones?.[0],
    url: o.website ?? undefined,
    address: {
      '@type': 'PostalAddress',
      streetAddress: loc?.addressEn ?? undefined,
      addressLocality: l?.nameEn,
      addressRegion: p?.nameEn,
      addressCountry: 'NP',
    },
    geo: loc?.lat && loc?.lng
      ? { '@type': 'GeoCoordinates', latitude: loc.lat, longitude: loc.lng }
      : undefined,
  }

  return (
    <Container className="py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      <Breadcrumbs items={[
        { href: '/', label: 'Nepal' },
        ...(p ? [{ href: `/nepal/${p.slug}`, label: p.nameEn }] : []),
        ...(p && d ? [{ href: `/nepal/${p.slug}/${d.slug}`, label: d.nameEn }] : []),
        ...(p && d && l ? [{ href: `/nepal/${p.slug}/${d.slug}/${l.slug}`, label: l.nameEn }] : []),
        { label: o.nameEn },
      ]} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight leading-tight">{o.nameEn}</h1>
          {o.nameNe && <p className="ne text-[--color-ink-2] text-[17px] mt-0.5">{o.nameNe}</p>}
          <p className="text-[13.5px] text-[--color-ink-3] mt-1">
            {cat?.nameEn}
            {l && <> · {l.nameEn}{loc?.ward ? `, Ward ${loc.ward}` : ''}</>}
          </p>
        </div>
        <ProvenanceChip verifiedAt={o.verifiedAt} verifiedBy={o.verifiedBy} />
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-6">
          {photos.slice(0, 6).map((ph, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={ph.id} src={ph.url} alt={ph.caption ?? o.nameEn}
                 width={ph.width ?? 600} height={ph.height ?? 450}
                 loading={i === 0 ? 'eager' : 'lazy'}
                 className="rounded-xl object-cover w-full aspect-[4/3] bg-[--color-surface-2]" />
          ))}
        </div>
      )}

      {o.descriptionEn && (
        <p className="mt-6 text-[16px] leading-relaxed text-[--color-ink-2] max-w-2xl">{o.descriptionEn}</p>
      )}

      <LeadButtons
        orgId={o.id}
        phones={loc?.phones ?? []}
        whatsapp={loc?.whatsapp ?? null}
        website={o.website ?? null}
        lat={loc?.lat ?? null}
        lng={loc?.lng ?? null}
      />

      <div className="grid sm:grid-cols-2 gap-6 mt-9">
        <section>
          <h2 className="text-[15px] font-semibold tracking-tight mb-2.5">Details</h2>
          <dl className="text-[14px] rounded-xl border border-[--color-line] bg-[--color-surface] divide-y divide-[--color-line]">
            {[
              ['Category', cat?.nameEn],
              ['Address', loc?.addressEn],
              ['Local level', l ? `${l.nameEn}${loc?.ward ? `, Ward ${loc.ward}` : ''}` : null],
              ['District', d?.nameEn],
              ['Province', p?.nameEn],
              ['Status', o.status === 'active' ? 'Open' : o.status.replace(/_/g, ' ')],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k as string} className="flex gap-3 px-3.5 py-2.5">
                <dt className="text-[--color-ink-3] w-28 shrink-0">{k}</dt>
                <dd className="text-[--color-ink]">{v as string}</dd>
              </div>
            ))}
          </dl>
        </section>

        {hours && (
          <section>
            <h2 className="text-[15px] font-semibold tracking-tight mb-2.5">Opening hours</h2>
            <dl className="text-[14px] rounded-xl border border-[--color-line] bg-[--color-surface] divide-y divide-[--color-line]">
              {DAYS.map((day) => {
                const slots = hours[day]
                return (
                  <div key={day} className="flex gap-3 px-3.5 py-2">
                    <dt className="text-[--color-ink-3] w-28 shrink-0">{DAY_LABEL[day]}</dt>
                    <dd>{slots?.length ? slots.map((s) => `${s[0]}–${s[1]}`).join(', ') : 'Closed'}</dd>
                  </div>
                )
              })}
            </dl>
          </section>
        )}
      </div>

      {/* The receipt. Every published fact can name where it came from. */}
      {facts.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[15px] font-semibold tracking-tight mb-2">How we know this</h2>
          <p className="text-[13px] text-[--color-ink-3] mb-3 max-w-2xl">
            Every field below records who confirmed it and when. If something is wrong, that is
            on us and we will fix it — this page exists so the mistake is traceable.
          </p>
          <ul className="text-[13px] rounded-xl border border-[--color-line] bg-[--color-surface]
                         divide-y divide-[--color-line]">
            {facts.map((f, i) => (
              <li key={i} className="flex flex-wrap gap-x-3 gap-y-1 px-3.5 py-2">
                <span className="text-[--color-ink-3] w-28 shrink-0 font-mono text-[12px]">{f.field}</span>
                <span className="text-[--color-ink-2]">{f.label ?? f.kind}</span>
                {f.verifiedAt && (
                  <span className="text-[--color-ink-3] ml-auto">
                    {new Date(f.verifiedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {f.verifiedBy ? ` · ${f.verifiedBy}` : ''}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-[13px] text-[--color-ink-3]">
        Is this your business?{' '}
        <Link href={`/claim/${o.slug}`} className="underline">Claim this page</Link> to keep it correct.
        Something wrong?{' '}
        <a href={`mailto:fix@simplenepal.com?subject=Correction: ${encodeURIComponent(o.nameEn)}`}
           className="underline">Tell us</a>.
      </p>
    </Container>
  )
}
