import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { db } from '@/db'
import { province, district, localLevel } from '@/db/schema'
import { eq, sql, asc } from 'drizzle-orm'
import { Container, Breadcrumbs, Stat } from '@/components/ui'

export const revalidate = 86400

/**
 * Prerendering the seven provinces is nice but not worth failing a deploy over.
 * Neon's free tier suspends compute when idle, so a build that happens to run
 * against a cold database would otherwise take the whole deployment down. On
 * error we return nothing and every province simply renders on first request.
 */
export async function generateStaticParams() {
  try {
    return (await db.select({ slug: province.slug }).from(province)).map((p) => ({ province: p.slug }))
  } catch (e) {
    console.warn('[build] province prerender skipped — database unreachable:', e)
    return []
  }
}

async function load(slug: string) {
  const [p] = await db.select().from(province).where(eq(province.slug, slug))
  if (!p) return null
  const districts = await db
    .select({
      id: district.id, slug: district.slug, nameEn: district.nameEn,
      nameNe: district.nameNe, hqEn: district.hqEn,
      locals: sql<number>`(select count(*) from ${localLevel} where ${localLevel.districtId} = ${district.id})`,
    })
    .from(district).where(eq(district.provinceId, p.id)).orderBy(asc(district.nameEn))
  return { p, districts }
}

export async function generateMetadata({ params }: { params: Promise<{ province: string }> }): Promise<Metadata> {
  const d = await load((await params).province)
  if (!d) return {}
  return {
    title: `${d.p.nameEn} — districts, local levels and places`,
    description: `${d.p.nameEn} (${d.p.nameNe}) has ${d.districts.length} districts. Headquarters: ${d.p.hqEn}. Browse every district and local level.`,
    alternates: { canonical: `/nepal/${d.p.slug}` },
  }
}

export default async function ProvincePage({ params }: { params: Promise<{ province: string }> }) {
  const data = await load((await params).province)
  if (!data) notFound()
  const { p, districts } = data
  const totalLocals = districts.reduce((s, d) => s + Number(d.locals), 0)

  return (
    <Container className="py-8">
      <Breadcrumbs items={[{ href: '/', label: 'Nepal' }, { label: p.nameEn }]} />
      <h1 className="text-[30px] font-bold tracking-tight leading-tight">{p.nameEn}</h1>
      <p className="ne text-[var(--color-ink-2)] text-[17px] mt-0.5">{p.nameNe}</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
        <Stat label="Districts" value={districts.length} />
        <Stat label="Local levels" value={totalLocals} />
        <Stat label="Headquarters" value={<span className="text-[16px]">{p.hqEn}</span>} />
        <Stat label="Area" value={<span className="text-[16px]">{p.areaSqKm?.toLocaleString()} km²</span>} />
      </div>

      {p.website && (
        <p className="text-[13px] text-[var(--color-ink-3)] mt-3">
          Official site: <a href={p.website} className="underline" rel="nofollow noopener">{p.website}</a>
        </p>
      )}

      <h2 className="text-[19px] font-semibold tracking-tight mt-10 mb-4">Districts</h2>
      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {districts.map((d) => (
          <li key={d.id}>
            <Link href={`/nepal/${p.slug}/${d.slug}`}
              className="block no-underline rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]
                         px-3.5 py-2.5 hover:border-[var(--color-crimson)] transition-colors">
              <div className="font-medium text-[14.5px]">{d.nameEn}</div>
              <div className="flex items-baseline gap-2">
                <span className="ne text-[12.5px] text-[var(--color-ink-3)]">{d.nameNe}</span>
                <span className="text-[11.5px] text-[var(--color-ink-3)] ml-auto">{d.locals} local levels</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  )
}
