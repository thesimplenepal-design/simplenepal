/**
 * Nepal's universities — the parent entities that every college affiliates to.
 *
 *   npm run seed:institutions
 *
 * Universities first, deliberately. Affiliation is the fact a student actually
 * needs, and an affiliation cannot be recorded until the thing being affiliated
 * TO exists. Import 1,500 colleges before this and you get 1,500 rows pointing
 * at nothing.
 *
 * Source: the University Grants Commission's own university page. That is the
 * body that recognises them, so it is `official` and this data is as good as it
 * gets — but note what it still is NOT. Nobody from SimpleNepal has visited any
 * of these. They are seeded with `registryName = 'UGC'` and `verifiedAt = null`,
 * so the quality gate keeps every one of them unpublished and they appear only
 * on the directory page, wearing a "listed in the UGC register" badge rather
 * than a verification badge.
 *
 * That distinction is the whole point of this file.
 */
import 'dotenv/config'
import { db } from './index'
import { organisation, institution, source, localLevel, district } from './schema'
import { eq, sql, ilike } from 'drizzle-orm'
import { slugify, nameKey } from '../lib/np'

type Uni = {
  name: string
  short: string
  estd: number
  /** As written by UGC — used to look up a local level where we can. */
  place: string
  district?: string
}

const UNIVERSITIES: Uni[] = [
  { name: 'Tribhuvan University', short: 'TU', estd: 1959, place: 'Kirtipur', district: 'Kathmandu' },
  { name: 'Nepal Sanskrit University', short: 'NSU', estd: 1986, place: 'Beljhundi', district: 'Dang' },
  { name: 'Kathmandu University', short: 'KU', estd: 1991, place: 'Dhulikhel', district: 'Kavrepalanchok' },
  { name: 'Purbanchal University', short: 'PU', estd: 1994, place: 'Biratnagar', district: 'Morang' },
  { name: 'Pokhara University', short: 'PokU', estd: 1997, place: 'Pokhara', district: 'Kaski' },
  { name: 'Lumbini Bouddha University', short: 'LBU', estd: 2005, place: 'Lumbini', district: 'Rupandehi' },
  { name: 'Far-Western University', short: 'FWU', estd: 2010, place: 'Bhimdatta', district: 'Kanchanpur' },
  { name: 'Mid-Western University', short: 'MWU', estd: 2010, place: 'Birendranagar', district: 'Surkhet' },
  { name: 'Agriculture and Forestry University', short: 'AFU', estd: 2010, place: 'Rampur', district: 'Chitwan' },
  { name: 'Nepal Open University', short: 'NOU', estd: 2016, place: 'Lalitpur', district: 'Lalitpur' },
  { name: 'Rajarshi Janak University', short: 'RJU', estd: 2017, place: 'Janakpur', district: 'Dhanusha' },
  { name: 'Madan Bhandari University of Science and Technology', short: 'MBUST', estd: 2022, place: '' },
  { name: 'Vidushi Yogmaya Himalayan Ayurveda University', short: '', estd: 0, place: '' },
]

async function main() {
  const label = 'University Grants Commission Nepal — list of universities'
  let [src] = await db.select().from(source).where(eq(source.label, label)).limit(1)
  if (!src) {
    ;[src] = await db.insert(source).values({
      kind: 'official', label, url: 'https://ugcnepal.edu.np/pages/university-7/',
    }).returning()
  }

  const now = new Date()
  let created = 0

  for (const u of UNIVERSITIES) {
    // Best-effort placement. A wrong local level is worse than none, so an
    // ambiguous match is left null rather than guessed at.
    let localLevelId: number | null = null
    let districtId: number | null = null
    if (u.district) {
      const [d] = await db.select({ id: district.id }).from(district)
        .where(ilike(district.nameEn, u.district)).limit(1)
      districtId = d?.id ?? null
      if (d && u.place) {
        const matches = await db.select({ id: localLevel.id }).from(localLevel)
          .where(sql`${localLevel.districtId} = ${d.id} and ${localLevel.nameEn} ilike ${u.place}`)
          .limit(2)
        if (matches.length === 1) localLevelId = matches[0].id
      }
    }

    const [org] = await db.insert(organisation).values({
      slug: slugify(u.name),
      nameEn: u.name,
      nameKey: nameKey(u.name),
      descriptionEn: u.estd
        ? `A university recognised by the University Grants Commission of Nepal, established ${u.estd}.`
        : 'A university recognised by the University Grants Commission of Nepal.',
      registryName: 'UGC',
      registryCheckedAt: now,
      // Deliberately NOT set: verifiedAt, verifiedBy. Nobody has been there.
      published: false,
    }).onConflictDoUpdate({
      target: organisation.slug,
      set: {
        nameEn: sql`excluded.name_en`, descriptionEn: sql`excluded.description_en`,
        registryName: sql`excluded.registry_name`,
        registryCheckedAt: sql`excluded.registry_checked_at`,
        updatedAt: now,
      },
    }).returning()

    if (!org) continue
    created++

    await db.insert(institution).values({
      organisationId: org.id,
      kind: 'university',
      affiliationType: 'constituent',
      establishedYear: u.estd || null,
      sourceId: src?.id ?? null,
    }).onConflictDoUpdate({
      target: institution.organisationId,
      set: { establishedYear: sql`excluded.established_year`, sourceId: sql`excluded.source_id` },
    })

    void localLevelId; void districtId   // placement lands with the field visit
  }

  console.log(`✓ ${created} universities listed from the UGC register`)
  console.log('  All unpublished and unverified — nobody has visited them.')
  console.log('  They appear on /colleges as register listings, never as verified records.')
  console.log('\n  Next: bring the affiliated colleges in with `npm run import:csv`,')
  console.log('  from a machine that can reach ugcnepal.edu.np.')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
