import Link from 'next/link'
import type { Metadata } from 'next'
import { db } from '@/db'
import { agency } from '@/db/schema'
import { eq, and, asc, sql, isNull } from 'drizzle-orm'
import { Container, Stat } from '@/components/ui'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Government of Nepal — ministries, departments and offices',
  description:
    'The structure of the Nepali state: federal ministries, their departments, and the ' +
    '753 local government offices — with what each one does and where.',
  alternates: { canonical: '/gov' },
}

async function load() {
  const ministries = await db
    .select({
      id: agency.id, slug: agency.slug, nameEn: agency.nameEn, nameNe: agency.nameNe,
      website: agency.website, status: agency.status, verifiedAt: agency.verifiedAt,
      depts: sql<number>`(select count(*)::int from ${agency} as d where d.parent_id = ${agency.id})`,
    })
    .from(agency)
    .where(and(eq(agency.level, 'federal'), eq(agency.kind, 'ministry'), eq(agency.status, 'active')))
    .orderBy(asc(agency.sort))

  const superseded = await db
    .select({
      slug: agency.slug, nameEn: agency.nameEn, nameNe: agency.nameNe,
      note: agency.successionNote,
      successorName: sql<string | null>`(select s.name_en from ${agency} as s where s.id = ${agency.succeededById})`,
      successorSlug: sql<string | null>`(select s.slug from ${agency} as s where s.id = ${agency.succeededById})`,
    })
    .from(agency)
    .where(eq(agency.status, 'merged'))

  const [counts] = await db.select({
    total: sql<number>`count(*)::int`,
    local: sql<number>`count(*) filter (where ${agency.level} = 'local')::int`,
    depts: sql<number>`count(*) filter (where ${agency.kind} = 'department')::int`,
  }).from(agency)

  return { ministries, superseded, counts }
}

export default async function GovIndex() {
  let data: Awaited<ReturnType<typeof load>> | null = null
  try { data = await load() } catch { /* build without a database */ }

  const ministries = data?.ministries ?? []
  const superseded = data?.superseded ?? []
  const c = data?.counts ?? { total: 0, local: 0, depts: 0 }

  return (
    <Container className="py-10">
      <h1 className="text-[32px] sm:text-[38px] font-bold tracking-tight leading-[1.15] max-w-2xl">
        The Government of Nepal
      </h1>
      <p className="mt-4 text-[17px] text-[--color-ink-2] max-w-2xl leading-relaxed">
        Which ministry, which department, which office — and what each one actually does for you.
        We map the state; we don&rsquo;t replace it.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
        <Stat label="Ministries" value={ministries.length} />
        <Stat label="Departments" value={c.depts} />
        <Stat label="Local gov offices" value={c.local.toLocaleString()} />
        <Stat label="Bodies mapped" value={c.total.toLocaleString()} />
      </div>

      <h2 className="text-[20px] font-semibold tracking-tight mt-12 mb-2">Federal ministries</h2>
      <p className="text-[13.5px] text-[--color-ink-3] mb-5 max-w-2xl">
        Nepal reduced its federal ministries in a restructuring announced in May 2026.
        These entries come from press reporting of that decision and are
        <strong className="text-[--color-ink-2]"> not yet confirmed against the Nepal Gazette</strong> —
        so we show them, but we don&rsquo;t pretend they&rsquo;re verified.
      </p>

      <ul className="grid sm:grid-cols-2 gap-2.5">
        {ministries.map((m) => (
          <li key={m.id}>
            <Link href={`/gov/${m.slug}`}
              className="flex items-start gap-3 no-underline rounded-xl border border-[--color-line]
                         bg-[--color-surface] px-4 py-3 hover:border-[--color-crimson] transition-colors h-full">
              <div className="min-w-0">
                <div className="font-medium text-[14.5px] leading-snug">{m.nameEn}</div>
                {m.nameNe && <div className="ne text-[13px] text-[--color-ink-3] mt-0.5">{m.nameNe}</div>}
                {m.depts > 0 && (
                  <div className="text-[11.5px] text-[--color-ink-3] mt-1">
                    {m.depts} department{m.depts === 1 ? '' : 's'}
                  </div>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {superseded.length > 0 && (
        <>
          <h2 className="text-[18px] font-semibold tracking-tight mt-12 mb-2">No longer exists</h2>
          <p className="text-[13.5px] text-[--color-ink-3] mb-4 max-w-2xl">
            We keep abolished and merged bodies rather than deleting them, so old references still
            lead somewhere useful.
          </p>
          <ul className="space-y-2">
            {superseded.map((s) => (
              <li key={s.slug}
                  className="rounded-xl border border-[--color-line] bg-[--color-surface-2] px-4 py-3">
                <div className="text-[14.5px] font-medium text-[--color-ink-2] line-through decoration-1">
                  {s.nameEn}
                </div>
                {s.nameNe && <div className="ne text-[12.5px] text-[--color-ink-3]">{s.nameNe}</div>}
                <div className="text-[13px] text-[--color-ink-2] mt-1.5">
                  {s.note}{' '}
                  {s.successorSlug && (
                    <Link href={`/gov/${s.successorSlug}`} className="underline">
                      {s.successorName}
                    </Link>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-12 rounded-xl border border-[--color-line] bg-[--color-surface] p-5 max-w-2xl">
        <h3 className="text-[15px] font-semibold mb-1.5">We are not the government</h3>
        <p className="text-[13.5px] text-[--color-ink-2] mb-0">
          Procedures, fees and office structures change, sometimes without notice. Everything here shows
          when we last checked it and where we checked it. Confirm before you travel — and if something
          is wrong, <a href="mailto:fix@simplenepal.com" className="underline">tell us</a> and we&rsquo;ll
          fix it the same day.
        </p>
      </div>
    </Container>
  )
}
