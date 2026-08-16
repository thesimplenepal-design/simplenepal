import { db } from './index'
import {
  organisation, institution, healthFacility, district, localLevel, location, source, officeholder,
} from './schema'
import { eq, sql, desc, asc, isNull, and } from 'drizzle-orm'

export type DirectoryEntry = {
  slug: string
  nameEn: string
  nameNe: string | null
  districtName: string | null
  detail: string | null
  /** True only when a person went there. Everything else is a register listing. */
  verified: boolean
  verifiedBy: string | null
  registryName: string | null
  published: boolean
}

/**
 * Colleges and universities.
 *
 * Affiliation is the headline, because it is the fact a student actually needs
 * and the one commercial college sites are least motivated to state plainly —
 * "affiliated to" and "recognised by" are not the same thing, and a page that
 * blurs them is doing it on purpose.
 */
export async function colleges(): Promise<{
  universities: DirectoryEntry[]
  colleges: DirectoryEntry[]
  counts: { total: number; verified: number; universities: number }
}> {
  const parent = { ...organisation }

  const rows = await db
    .select({
      slug: organisation.slug, nameEn: organisation.nameEn, nameNe: organisation.nameNe,
      published: organisation.published, verifiedAt: organisation.verifiedAt,
      verifiedBy: organisation.verifiedBy, registryName: organisation.registryName,
      kind: institution.kind, affiliationType: institution.affiliationType,
      establishedYear: institution.establishedYear,
      districtName: district.nameEn,
      affiliatedTo: sql<string | null>`(
        select p.name_en from organisation p where p.id = ${institution.affiliatedToId}
      )`,
    })
    .from(institution)
    .innerJoin(organisation, eq(organisation.id, institution.organisationId))
    .leftJoin(location, and(eq(location.organisationId, organisation.id), eq(location.isPrimary, true)))
    .leftJoin(localLevel, eq(localLevel.id, location.localLevelId))
    .leftJoin(district, eq(district.id, localLevel.districtId))
    .orderBy(asc(organisation.nameEn))

  void parent

  const map = (r: (typeof rows)[number]): DirectoryEntry => ({
    slug: r.slug, nameEn: r.nameEn, nameNe: r.nameNe,
    districtName: r.districtName,
    detail: [
      r.affiliatedTo ? `Affiliated to ${r.affiliatedTo}` : null,
      r.affiliationType,
      r.establishedYear ? `est. ${r.establishedYear}` : null,
    ].filter(Boolean).join(' · ') || null,
    verified: r.verifiedAt !== null,
    verifiedBy: r.verifiedBy,
    registryName: r.registryName,
    published: r.published,
  })

  const universities = rows.filter((r) => r.kind === 'university' || r.kind === 'deemed').map(map)
  const rest = rows.filter((r) => r.kind !== 'university' && r.kind !== 'deemed').map(map)

  return {
    universities,
    colleges: rest,
    counts: {
      total: rows.length,
      verified: rows.filter((r) => r.verifiedAt !== null).length,
      universities: universities.length,
    },
  }
}

export type FacilityEntry = DirectoryEntry & {
  kind: string
  ownership: string
  beds: number | null
  hasEmergency: boolean | null
}

export async function facilities(): Promise<FacilityEntry[]> {
  const rows = await db
    .select({
      slug: organisation.slug, nameEn: organisation.nameEn, nameNe: organisation.nameNe,
      published: organisation.published, verifiedAt: organisation.verifiedAt,
      verifiedBy: organisation.verifiedBy, registryName: organisation.registryName,
      kind: healthFacility.kind, ownership: healthFacility.ownership,
      beds: healthFacility.beds, hasEmergency: healthFacility.hasEmergency,
      districtName: district.nameEn,
    })
    .from(healthFacility)
    .innerJoin(organisation, eq(organisation.id, healthFacility.organisationId))
    .leftJoin(location, and(eq(location.organisationId, organisation.id), eq(location.isPrimary, true)))
    .leftJoin(localLevel, eq(localLevel.id, location.localLevelId))
    .leftJoin(district, eq(district.id, localLevel.districtId))
    .orderBy(asc(organisation.nameEn))

  return rows.map((r) => ({
    slug: r.slug, nameEn: r.nameEn, nameNe: r.nameNe, districtName: r.districtName,
    detail: [r.beds ? `${r.beds} beds` : null].filter(Boolean).join(' · ') || null,
    verified: r.verifiedAt !== null, verifiedBy: r.verifiedBy,
    registryName: r.registryName, published: r.published,
    kind: r.kind, ownership: r.ownership, beds: r.beds, hasEmergency: r.hasEmergency,
  }))
}

/** Current holders of a public office, for the agency page. */
export async function holdersFor(agencyId: number) {
  return db
    .select({
      roleEn: officeholder.roleEn, roleNe: officeholder.roleNe,
      personName: officeholder.personName, fromDate: officeholder.fromDate,
      contactPublic: officeholder.contactPublic, confidence: officeholder.confidence,
      note: officeholder.note,
      sourceLabel: source.label, sourceUrl: source.url,
    })
    .from(officeholder)
    .leftJoin(source, eq(source.id, officeholder.sourceId))
    .where(and(
      eq(officeholder.agencyId, agencyId),
      eq(officeholder.published, true),
      isNull(officeholder.toDate),          // current only; past holders are history, not contact info
    ))
    .orderBy(desc(officeholder.confidence))
}
