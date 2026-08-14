import { cookies } from 'next/headers'
import { db } from '@/db'
import { category, localLevel, district, province, organisation } from '@/db/schema'
import { eq, asc, desc, sql } from 'drizzle-orm'
import { CaptureForm } from './form'
import { Login } from './login'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

/**
 * The field-capture tool.
 *
 * Sanjog is verifying places on the road, on a phone, sometimes on a bad
 * connection, sometimes standing in a doorway. So: one column, big targets,
 * GPS in one tap, camera in one tap, and nothing required that cannot be
 * answered while standing outside the building.
 *
 * The plan says "the admin tool is the product." At this stage it is literally
 * the only tool that matters — the public site is downstream of what gets
 * captured here.
 */
export default async function CapturePage() {
  const authed = (await cookies()).get('sn_admin')?.value === 'ok'
  if (!authed) return <Login />

  const [cats, places, recent] = await Promise.all([
    db.select({
      id: category.id, slug: category.slug, nameEn: category.nameEn, parentId: category.parentId,
    }).from(category).orderBy(asc(category.sort)),
    db.select({
      id: localLevel.id,
      label: sql<string>`${localLevel.nameEn} || ' · ' || ${district.nameEn}`,
    }).from(localLevel)
      .innerJoin(district, eq(district.id, localLevel.districtId))
      .orderBy(asc(district.nameEn), asc(localLevel.nameEn)),
    db.select({
      id: organisation.id, nameEn: organisation.nameEn, slug: organisation.slug,
      score: organisation.qualityScore, published: organisation.published,
    }).from(organisation).orderBy(desc(organisation.updatedAt)).limit(12),
  ])

  return <CaptureForm categories={cats} places={places} recent={recent} />
}
