import type { MetadataRoute } from 'next'
import { db } from '@/db'
import { province, district, localLevel, organisation } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// Regenerate hourly. A build-time snapshot would freeze the sitemap at whatever
// existed on the day of deploy — which for a site that grows by field visits is
// permanently wrong.
export const revalidate = 3600

/**
 * Only URLs that have earned indexing appear here. A local-level hub with no
 * verified places is deliberately excluded — the same rule as its `robots` meta.
 * Submitting thin pages to Google is how programmatic sites get demoted.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  try {
    return await build()
  } catch (e) {
    // A cold database at build time must not fail the deploy. Ship the homepage
    // and let the next revalidation fill in the rest.
    console.warn('[build] sitemap fell back to homepage only — database unreachable:', e)
    return [{ url: SITE, changeFrequency: 'daily', priority: 1 }]
  }
}

async function build(): Promise<MetadataRoute.Sitemap> {
  const [provinces, districts, locals, orgs] = await Promise.all([
    db.select({ slug: province.slug }).from(province),
    db.select({ p: province.slug, d: district.slug }).from(district)
      .innerJoin(province, eq(province.id, district.provinceId)),
    db.select({
      p: province.slug, d: district.slug, l: localLevel.slug,
      orgs: sql<number>`(select count(*) from organisation o
                         join location loc on loc.organisation_id = o.id
                         where loc.local_level_id = ${localLevel.id} and o.published = true)`,
    }).from(localLevel)
      .innerJoin(district, eq(district.id, localLevel.districtId))
      .innerJoin(province, eq(province.id, district.provinceId)),
    db.select({ slug: organisation.slug, updatedAt: organisation.updatedAt })
      .from(organisation).where(eq(organisation.published, true)),
  ])

  return [
    { url: SITE, changeFrequency: 'daily', priority: 1 },
    ...provinces.map((p) => ({
      url: `${SITE}/nepal/${p.slug}`, changeFrequency: 'monthly' as const, priority: 0.8,
    })),
    ...districts.map((d) => ({
      url: `${SITE}/nepal/${d.p}/${d.d}`, changeFrequency: 'monthly' as const, priority: 0.7,
    })),
    ...locals.filter((l) => Number(l.orgs) > 0).map((l) => ({
      url: `${SITE}/nepal/${l.p}/${l.d}/${l.l}`, changeFrequency: 'weekly' as const, priority: 0.6,
    })),
    ...orgs.map((o) => ({
      url: `${SITE}/biz/${o.slug}`, lastModified: o.updatedAt,
      changeFrequency: 'weekly' as const, priority: 0.9,
    })),
  ]
}
