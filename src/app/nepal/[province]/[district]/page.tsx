import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/db'
import { province, district, localLevel } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'
import { Container, Breadcrumbs, Stat, KIND_LABEL } from '@/components/ui'

export const revalidate = 86400

async function load(pSlug: string, dSlug: string) {
  const [row] = await db
    .select({ p: province, d: district })
    .from(district)
    .innerJoin(province, eq(province.id, district.provinceId))
    .where(and(eq(province.slug, pSlug), eq(district.slug, dSlug)))
  if (!row) return null
  const locals = await db.select().from(localLevel)
    .where(eq(localLevel.districtId, row.d.id))
    .orderBy(asc(localLevel.kind), asc(localLevel.nameEn))
  return { ...row, locals }
}

export async function generateMetadata(
  { params }: { params: Promise<{ province: string; district: string }> },
): Promise<Metadata> {
  const { province: p, district: d } = await params
  const data = await load(p, d)
  if (!data) return {}
  const wards = data.locals.reduce((s, l) => s + l.wards, 0)
  return {
    title: `${data.d.nameEn} District — ${data.locals.length} local levels`,
    description: `${data.d.nameEn} (${data.d.nameNe}) in ${data.p.nameEn} has ${data.locals.length} local levels and ${wards} wards. Headquarters: ${data.d.hqEn}.`,
    alternates: { canonical: `/nepal/${p}/${d}` },
  }
}

export default async function DistrictPage(
  { params }: { params: Promise<{ province: string; district: string }> },
) {
  const { province: pSlug, district: dSlug } = await params
  const data = await load(pSlug, dSlug)
  if (!data) notFound()
  const { p, d, locals } = data
  const wards = locals.reduce((s, l) => s + l.wards, 0)

  const groups = ['metropolitan', 'sub_metropolitan', 'municipality', 'rural_municipality'] as const

  return (
    <Container className="py-8">
      <Breadcrumbs items={[
        { href: '/', label: 'Nepal' },
        { href: `/nepal/${p.slug}`, label: p.nameEn },
        { label: `${d.nameEn} District` },
      ]} />
      <h1 className="text-[30px] font-bold tracking-tight leading-tight">{d.nameEn} District</h1>
      <p className="ne text-[var(--color-ink-2)] text-[17px] mt-0.5">{d.nameNe}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
        <Stat label="Local levels" value={locals.length} />
        <Stat label="Wards" value={wards} />
        <Stat label="Headquarters" value={<span className="text-[16px]">{d.hqEn}</span>} />
        <Stat label="Area" value={<span className="text-[16px]">{d.areaSqKm?.toLocaleString()} km²</span>} />
      </div>

      {groups.map((g) => {
        const items = locals.filter((l) => l.kind === g)
        if (!items.length) return null
        return (
          <section key={g} className="mt-9">
            <h2 className="text-[16px] font-semibold tracking-tight mb-3">
              {KIND_LABEL[g].en}
              <span className="ne text-[var(--color-ink-3)] font-normal text-[13.5px] ml-2">{KIND_LABEL[g].ne}</span>
              <span className="text-[var(--color-ink-3)] font-normal text-[13px] ml-2">· {items.length}</span>
            </h2>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {items.map((l) => (
                <li key={l.id}>
                  <Link href={`/nepal/${p.slug}/${d.slug}/${l.slug}`}
                    className="block no-underline rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]
                               px-3.5 py-2.5 hover:border-[var(--color-crimson)] transition-colors">
                    <div className="font-medium text-[14.5px]">{l.nameEn}</div>
                    <div className="flex items-baseline gap-2">
                      <span className="ne text-[12.5px] text-[var(--color-ink-3)]">{l.nameNe}</span>
                      <span className="text-[11.5px] text-[var(--color-ink-3)] ml-auto">{l.wards} wards</span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </Container>
  )
}
