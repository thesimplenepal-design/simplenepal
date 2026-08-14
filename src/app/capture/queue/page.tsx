import { cookies } from 'next/headers'
import Link from 'next/link'
import { db } from '@/db'
import { organisation, localLevel, location } from '@/db/schema'
import { eq, desc, asc, sql } from 'drizzle-orm'
import { Container } from '@/components/ui'
import { Login } from '../login'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

/**
 * Two lists, and they are the whole operating rhythm of the company right now:
 * what is not good enough to publish yet, and what is about to go stale.
 */
export default async function Queue() {
  if ((await cookies()).get('sn_admin')?.value !== 'ok') return <Login />

  const drafts = await db.select({
    id: organisation.id, slug: organisation.slug, nameEn: organisation.nameEn,
    score: organisation.qualityScore, place: localLevel.nameEn,
  }).from(organisation)
    .leftJoin(location, eq(location.organisationId, organisation.id))
    .leftJoin(localLevel, eq(localLevel.id, location.localLevelId))
    .where(eq(organisation.published, false))
    .orderBy(desc(organisation.qualityScore))

  const stale = await db.select({
    slug: organisation.slug, nameEn: organisation.nameEn, verifiedAt: organisation.verifiedAt,
  }).from(organisation)
    .where(sql`${organisation.published} = true and ${organisation.verifiedAt} < now() - interval '150 days'`)
    .orderBy(asc(organisation.verifiedAt))

  return (
    <Container className="py-8 max-w-lg">
      <div className="flex items-baseline justify-between">
        <h1 className="text-[22px] font-bold tracking-tight">Queue</h1>
        <Link href="/capture" className="text-[13px] underline text-[--color-ink-3]">Capture</Link>
      </div>

      <h2 className="text-[14px] font-semibold mt-7 mb-2">Drafts — not live yet ({drafts.length})</h2>
      {drafts.length === 0 ? (
        <p className="text-[14px] text-[--color-ink-3]">Nothing waiting. Everything captured is live.</p>
      ) : (
        <ul className="text-[14px] rounded-xl border border-[--color-line] divide-y divide-[--color-line]">
          {drafts.map((d) => (
            <li key={d.id} className="flex gap-3 px-3.5 py-2.5">
              <span className="truncate">{d.nameEn}</span>
              <span className="text-[--color-ink-3] text-[12.5px] truncate">{d.place}</span>
              <span className="ml-auto tabular-nums text-[--color-ink-3] shrink-0">{d.score}/100</span>
            </li>
          ))}
        </ul>
      )}

      <h2 className="text-[14px] font-semibold mt-8 mb-2">
        Due a re-check within 30 days ({stale.length})
      </h2>
      {stale.length === 0 ? (
        <p className="text-[14px] text-[--color-ink-3]">Everything is inside its freshness window.</p>
      ) : (
        <ul className="text-[14px] rounded-xl border border-[--color-line] divide-y divide-[--color-line]">
          {stale.map((s) => (
            <li key={s.slug} className="flex gap-3 px-3.5 py-2.5">
              <Link href={`/biz/${s.slug}`} className="truncate underline">{s.nameEn}</Link>
              <span className="ml-auto text-[--color-ink-3] text-[12.5px] shrink-0">
                {s.verifiedAt && new Date(s.verifiedAt).toLocaleDateString('en-GB')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Container>
  )
}
