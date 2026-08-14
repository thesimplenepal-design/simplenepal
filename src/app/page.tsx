import Link from 'next/link'
import { db } from '@/db'
import { province, district, localLevel, organisation } from '@/db/schema'
import { sql, eq } from 'drizzle-orm'
import { Container, Stat } from '@/components/ui'

export const revalidate = 3600

export default async function Home() {
  // Same reasoning as generateStaticParams: a cold database at build time must
  // not fail the deploy. Render the shell, fill it in on the next revalidation.
  let provinces: Awaited<ReturnType<typeof loadProvinces>> = []
  let c = { districts: 0, locals: 0, wards: 0, published: 0 }
  try {
    const r = await loadAll()
    provinces = r.provinces
    c = r.counts
  } catch (e) {
    console.warn('[build] homepage stats unavailable — database unreachable:', e)
  }

  return render(provinces, c)
}

function loadProvinces() {
  return db.select().from(province).orderBy(province.id)
}

async function loadAll() {
  const [provinces, counts] = await Promise.all([
    loadProvinces(),
    db.select({
      districts: sql<number>`(select count(*) from ${district})`,
      locals: sql<number>`(select count(*) from ${localLevel})`,
      wards: sql<number>`(select coalesce(sum(${localLevel.wards}),0) from ${localLevel})`,
      published: sql<number>`(select count(*) from ${organisation} where ${organisation.published} = true)`,
    }).from(sql`(select 1) as _`),
  ])
  return { provinces, counts: counts[0] }
}

function render(
  provinces: Awaited<ReturnType<typeof loadProvinces>>,
  c: { districts: number; locals: number; wards: number; published: number },
) {
  return (
    <Container className="py-10">
      <h1 className="text-[34px] sm:text-[42px] font-bold tracking-tight leading-[1.1] max-w-2xl">
        Nepal, made simple.
      </h1>
      <p className="mt-4 text-[17px] text-[--color-ink-2] max-w-2xl leading-relaxed">
        Every province, district and local level in the country — and the places inside them,
        checked in person. Each record says who verified it and when.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
        <Stat label="Provinces" value="7" />
        <Stat label="Districts" value={String(c.districts)} />
        <Stat label="Local levels" value={Number(c.locals).toLocaleString()} />
        <Stat label="Wards" value={Number(c.wards).toLocaleString()} />
      </div>

      <p className="text-[13px] text-[--color-ink-3] mt-3">
        {Number(c.published).toLocaleString()} verified place{Number(c.published) === 1 ? '' : 's'} published
        so far — each one visited, photographed and confirmed. We publish nothing we have not checked.
      </p>

      <h2 className="text-[20px] font-semibold tracking-tight mt-12 mb-4">Browse by province</h2>
      <ul className="grid sm:grid-cols-2 gap-2.5">
        {provinces.map((p) => (
          <li key={p.id}>
            <Link
              href={`/nepal/${p.slug}`}
              className="flex items-baseline justify-between gap-3 no-underline rounded-xl border
                         border-[--color-line] bg-[--color-surface] px-4 py-3
                         hover:border-[--color-crimson] transition-colors"
            >
              <span>
                <span className="font-medium">{p.nameEn}</span>
                <span className="ne text-[--color-ink-3] text-[13.5px] ml-2">{p.nameNe}</span>
              </span>
              <span className="text-[12.5px] text-[--color-ink-3] shrink-0">{p.hqEn}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Container>
  )
}
