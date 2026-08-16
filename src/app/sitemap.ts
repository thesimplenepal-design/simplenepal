import type { MetadataRoute } from 'next'
import { db } from '@/db'
import { province, district, localLevel, organisation, agency, service } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'
import { SITE_URL as SITE } from '@/lib/site'

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
  const [provinces, districts, locals, orgs, agencies, services] = await Promise.all([
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
    db.select({ slug: agency.slug, updatedAt: agency.updatedAt })
      .from(agency).where(eq(agency.published, true)),
    db.select({ slug: service.slug, updatedAt: service.updatedAt })
      .from(service).where(eq(service.published, true)),
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
    { url: `${SITE}/arrive`, changeFrequency: 'monthly' as const, priority: 0.9 },
    { url: `${SITE}/prices`, changeFrequency: 'weekly' as const, priority: 0.9 },
    { url: `${SITE}/promise`, changeFrequency: 'yearly' as const, priority: 0.6 },
    { url: `${SITE}/colleges`, changeFrequency: 'weekly' as const, priority: 0.85 },
    { url: `${SITE}/hospitals`, changeFrequency: 'weekly' as const, priority: 0.85 },
    { url: `${SITE}/rates`, changeFrequency: 'daily' as const, priority: 0.9 },
    { url: `${SITE}/holidays`, changeFrequency: 'weekly' as const, priority: 0.85 },
    { url: `${SITE}/emergency`, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: `${SITE}/rates/gold`, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${SITE}/date`, changeFrequency: 'daily' as const, priority: 0.85 },
    { url: `${SITE}/gov`, changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${SITE}/how-to`, changeFrequency: 'weekly' as const, priority: 0.9 },
    ...agencies.map((a) => ({
      url: `${SITE}/gov/${a.slug}`, lastModified: a.updatedAt,
      changeFrequency: 'monthly' as const, priority: 0.6,
    })),
    ...services.map((s) => ({
      url: `${SITE}/how-to/${s.slug}`, lastModified: s.updatedAt,
      changeFrequency: 'weekly' as const, priority: 0.95,
    })),
  ]
}
