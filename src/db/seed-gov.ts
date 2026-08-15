/**
 * Seeds the governance spine.
 *
 *   npm run seed:gov
 *
 * Honesty note, and the whole point of the provenance model:
 * Nepal cut federal ministries from 21 to 18 on 14 May 2026. The best source I
 * could reach is press reporting of that cabinet decision — NOT the Nepal
 * Gazette. So every ministry below is seeded with that source attached, a
 * confidence of 60, and `verifiedAt = null`, which keeps it OUT of the published
 * set and makes the page say so out loud.
 *
 * To publish them: confirm each against the Gazette or the ministry's own site,
 * then set verifiedAt/verifiedBy and re-run the quality pass.
 */
import 'dotenv/config'
import { db } from './index'
import {
  agency, agencyOffice, agencyJurisdiction, source, fact,
  service, serviceStep, serviceDocument, serviceAgency,
  localLevel, district,
} from './schema'
import { eq, and, sql } from 'drizzle-orm'
import { slugify } from '../lib/np'

const BY = 'Sanjog'

/**
 * Insert a source once. Re-running the seed must not pile up duplicate source
 * rows — provenance loses its meaning if the same citation exists five times.
 */
type SourceKind = (typeof source.kind.enumValues)[number]

async function upsertSource(v: { kind: SourceKind; label: string; url?: string }) {
  const [existing] = await db.select().from(source).where(eq(source.label, v.label)).limit(1)
  if (existing) return existing
  const [row] = await db.insert(source).values(v).returning()
  return row
}

async function main() {
  // ── sources ─────────────────────────────────────────────────────────
  const srcRestructure = await upsertSource({
    kind: 'web',
    label: 'Kathmandu Post, "Nepal cuts federal ministries to 18 in administrative overhaul", 14 May 2026 — press report of the cabinet decision, NOT the Gazette',
    url: 'https://kathmandupost.com/national/2026/05/14/nepal-cuts-federal-ministries-to-18-in-administrative-overhaul',
  })

  const srcLocalLevels = await upsertSource({
    kind: 'official',
    label: 'Official federal restructuring dataset — 753 local governments (via local-states-nepal, MIT)',
    url: 'https://github.com/sagautam5/local-states-nepal',
  })

  // ── federal ministries ──────────────────────────────────────────────
  // English names from the sourced press report. Nepali names are the standard
  // renderings; where the May 2026 merge may have changed the legal Nepali name,
  // this must be checked before publication.
  const MINISTRIES: [string, string | null, string | null][] = [
    ['Ministry of Finance', 'अर्थ मन्त्रालय', 'mof.gov.np'],
    ['Ministry of Home Affairs', 'गृह मन्त्रालय', 'moha.gov.np'],
    ['Ministry of Foreign Affairs', 'परराष्ट्र मन्त्रालय', 'mofa.gov.np'],
    ['Ministry of Defence', 'रक्षा मन्त्रालय', 'mod.gov.np'],
    ['Ministry of Law, Justice and Parliamentary Affairs', 'कानून, न्याय तथा संसदीय मामिला मन्त्रालय', 'moljpa.gov.np'],
    ['Ministry of Industry, Commerce and Supplies', 'उद्योग, वाणिज्य तथा आपूर्ति मन्त्रालय', 'moics.gov.np'],
    ['Ministry of Culture, Tourism and Civil Aviation', 'संस्कृति, पर्यटन तथा नागरिक उड्डयन मन्त्रालय', 'tourism.gov.np'],
    ['Ministry of Energy, Water Resources and Irrigation', 'ऊर्जा, जलस्रोत तथा सिँचाइ मन्त्रालय', 'moewri.gov.np'],
    ['Ministry of Education and Sports', 'शिक्षा तथा खेलकुद मन्त्रालय', 'moe.gov.np'],
    ['Ministry of Communications', 'सञ्चार मन्त्रालय', 'mocit.gov.np'],
    ['Ministry of Youth, Labour and Employment', 'युवा, श्रम तथा रोजगार मन्त्रालय', 'moless.gov.np'],
    ['Ministry of Land, Cooperatives, Federal Affairs and General Administration', 'भूमि व्यवस्था, सहकारी, संघीय मामिला तथा सामान्य प्रशासन मन्त्रालय', 'molcpa.gov.np'],
    ['Ministry of Women, Children, Gender and Sexual Minorities and Social Security', 'महिला, बालबालिका तथा सामाजिक सुरक्षा मन्त्रालय', 'mowcsc.gov.np'],
    ['Ministry of Health and Food Security', 'स्वास्थ्य तथा खाद्य सुरक्षा मन्त्रालय', 'mohp.gov.np'],
    ['Ministry of Infrastructure Development', 'पूर्वाधार विकास मन्त्रालय', null],
    ['Ministry of Agriculture, Forests and Environment', 'कृषि, वन तथा वातावरण मन्त्रालय', null],
    ['Ministry of Science, Technology and Innovation', 'विज्ञान, प्रविधि तथा नवप्रवर्तन मन्त्रालय', null],
  ]

  const ministryId = new Map<string, number>()
  let sort = 0
  for (const [en, ne, site] of MINISTRIES) {
    const [row] = await db.insert(agency).values({
      slug: slugify(en),
      nameEn: en,
      nameNe: ne,
      level: 'federal',
      kind: 'ministry',
      website: site ? `https://${site}` : null,
      status: 'active',
      sort: (sort += 10),
      published: false,           // not Gazette-confirmed yet — see header note
    }).onConflictDoNothing().returning()
    if (row) {
      ministryId.set(en, row.id)
      await db.insert(fact).values({
        entityType: 'agency', entityId: row.id, field: 'name',
        sourceId: srcRestructure.id, confidence: 60,
        note: 'Press report of the 14 May 2026 cabinet decision. Confirm against the Nepal Gazette before publishing.',
      }).onConflictDoNothing()
    }
  }
  console.log(`✓ ${ministryId.size} federal ministries (unpublished — awaiting Gazette confirmation)`)

  // ── superseded ministries ───────────────────────────────────────────
  // Kept, not deleted. Old links keep working and a confused citizen gets told
  // where the thing went.
  const infra = ministryId.get('Ministry of Infrastructure Development')
  const sci = ministryId.get('Ministry of Science, Technology and Innovation')
  const SUPERSEDED: [string, string | null, number | undefined, string][] = [
    ['Ministry of Physical Infrastructure and Transport', 'भौतिक पूर्वाधार तथा यातायात मन्त्रालय', infra,
     'Merged into the Ministry of Infrastructure Development in the May 2026 restructuring.'],
    ['Ministry of Urban Development', 'सहरी विकास मन्त्रालय', infra,
     'Merged into the Ministry of Infrastructure Development in the May 2026 restructuring.'],
  ]
  for (const [en, ne, successor, note] of SUPERSEDED) {
    const [row] = await db.insert(agency).values({
      slug: slugify(en), nameEn: en, nameNe: ne,
      level: 'federal', kind: 'ministry',
      status: 'merged', succeededById: successor ?? null, successionNote: note,
      published: false, sort: 900,
    }).onConflictDoNothing().returning()
    if (row) {
      await db.insert(fact).values({
        entityType: 'agency', entityId: row.id, field: 'status',
        sourceId: srcRestructure.id, confidence: 70, note,
      }).onConflictDoNothing()
    }
  }
  console.log(`✓ ${SUPERSEDED.length} superseded ministries recorded with successors`)

  // ── departments people actually deal with ───────────────────────────
  const land = ministryId.get('Ministry of Land, Cooperatives, Federal Affairs and General Administration')
  const home = ministryId.get('Ministry of Home Affairs')
  const DEPTS: [string, string | null, number | undefined, string | null][] = [
    ['Department of Land Management and Archive', 'भूमि व्यवस्था तथा अभिलेख विभाग', land, 'dolma.gov.np'],
    ['Survey Department', 'नापी विभाग', land, 'dos.gov.np'],
    ['Department of National ID and Civil Registration', 'राष्ट्रिय परिचयपत्र तथा पञ्जीकरण विभाग', home, 'donidcr.gov.np'],
    ['Department of Passports', 'राहदानी विभाग', home, 'nepalpassport.gov.np'],
    ['Department of Immigration', 'अध्यागमन विभाग', home, 'immigration.gov.np'],
  ]
  const deptId = new Map<string, number>()
  for (const [en, ne, parent, site] of DEPTS) {
    const [row] = await db.insert(agency).values({
      slug: slugify(en), nameEn: en, nameNe: ne,
      level: 'federal', kind: 'department', parentId: parent ?? null,
      website: site ? `https://${site}` : null,
      published: false, sort: (sort += 10),
    }).onConflictDoNothing().returning()
    if (row) deptId.set(en, row.id)
  }
  console.log(`✓ ${deptId.size} departments`)

  // ── 753 local government offices ────────────────────────────────────
  // Free, official, and it makes ward-level services answerable everywhere in
  // the country from day one.
  const locals = await db
    .select({
      id: localLevel.id, slug: localLevel.slug, nameEn: localLevel.nameEn,
      nameNe: localLevel.nameNe, kind: localLevel.kind, wards: localLevel.wards,
      website: localLevel.website, districtId: localLevel.districtId,
      dSlug: district.slug,
    })
    .from(localLevel)
    .innerJoin(district, eq(district.id, localLevel.districtId))

  const KIND_EN: Record<string, string> = {
    metropolitan: 'Metropolitan City Office',
    sub_metropolitan: 'Sub-Metropolitan City Office',
    municipality: 'Municipality Office',
    rural_municipality: 'Rural Municipality Office',
  }

  // Batched, not row by row. Seeding runs from Nepal against a database in
  // Singapore; a per-row loop is ~3,000 sequential round trips, which takes
  // minutes and dies if any one of them drops. Chunked inserts make it four
  // round trips per 250 offices, and a re-run picks up exactly where it stopped
  // because every insert ignores conflicts.
  const now = new Date()
  const CHUNK = 250
  const chunk = <T,>(xs: T[]) =>
    Array.from({ length: Math.ceil(xs.length / CHUNK) }, (_, i) => xs.slice(i * CHUNK, i * CHUNK + CHUNK))

  let localCount = 0
  for (const batch of chunk(locals)) {
    const inserted = await db.insert(agency).values(
      batch.map((l) => ({
        slug: `${l.dSlug}-${l.slug}-office`,
        nameEn: `${l.nameEn} ${KIND_EN[l.kind]}`,
        nameNe: `${l.nameNe} कार्यालय`,
        level: 'local' as const,
        kind: 'office' as const,
        districtId: l.districtId,
        localLevelId: l.id,
        website: l.website,
        published: true,                     // official dataset — safe to publish
        verifiedAt: now,
        verifiedBy: 'official dataset',
      })),
    ).onConflictDoNothing().returning({ id: agency.id, localLevelId: agency.localLevelId })

    if (inserted.length === 0) continue
    localCount += inserted.length

    const byLocal = new Map(batch.map((l) => [l.id, l]))

    const offices = await db.insert(agencyOffice).values(
      inserted.map((row) => ({
        agencyId: row.id,
        localLevelId: row.localLevelId,
        districtId: byLocal.get(row.localLevelId!)?.districtId,
        isPrimary: true,
      })),
    ).returning({ id: agencyOffice.id, localLevelId: agencyOffice.localLevelId })

    // Each office serves its own local level. Ward-level detail comes later, by phone.
    await db.insert(agencyJurisdiction).values(
      offices.map((o) => ({
        agencyOfficeId: o.id, coversType: 'local_level', coversId: o.localLevelId!,
      })),
    )

    await db.insert(fact).values(
      inserted.map((row) => ({
        entityType: 'agency' as const, entityId: row.id, field: 'name',
        sourceId: srcLocalLevels.id, confidence: 95,
        verifiedBy: 'official dataset', verifiedAt: now,
      })),
    ).onConflictDoNothing()

    console.log(`  … ${localCount}/${locals.length} local offices`)
  }

  // Repair pass. If an earlier run died between inserting an agency and giving
  // it an office, the conflict guard above would skip that agency forever and
  // it would silently never appear in the office finder. Catch those.
  const orphans = await db
    .select({ id: agency.id, localLevelId: agency.localLevelId, districtId: agency.districtId })
    .from(agency)
    .where(and(
      eq(agency.level, 'local'),
      sql`not exists (select 1 from ${agencyOffice} o where o.agency_id = ${agency.id})`,
    ))

  if (orphans.length > 0) {
    for (const batch of chunk(orphans)) {
      const offices = await db.insert(agencyOffice).values(
        batch.map((o) => ({
          agencyId: o.id, localLevelId: o.localLevelId, districtId: o.districtId, isPrimary: true,
        })),
      ).returning({ id: agencyOffice.id, localLevelId: agencyOffice.localLevelId })

      await db.insert(agencyJurisdiction).values(
        offices.map((o) => ({
          agencyOfficeId: o.id, coversType: 'local_level', coversId: o.localLevelId!,
        })),
      )
    }
    console.log(`  ↻ repaired ${orphans.length} office(s) left behind by an interrupted run`)
  }

  console.log(`✓ ${localCount} local government offices, each with jurisdiction over its own local level`)

  // ── one service, end to end: birth registration ─────────────────────
  const [srcBirth] = await db.insert(source).values({
    kind: 'official',
    label: 'Department of National ID and Civil Registration — civil registration procedure',
    url: 'https://donidcr.gov.np',
  }).returning()

  const [birth] = await db.insert(service).values({
    slug: 'register-a-birth',
    nameEn: 'Register a birth',
    nameNe: 'जन्म दर्ता',
    category: 'civil_registration',
    summaryEn:
      'Every birth in Nepal must be registered at the ward office of the local government where ' +
      'the birth took place or where the family lives. Registration within 35 days is free; after ' +
      'that a late fee may apply. The birth certificate is required for school admission, ' +
      'citizenship, and a passport — so it is usually the first document a Nepali ever needs.',
    summaryNe:
      'नेपालमा जन्मेको हरेक बच्चाको जन्म दर्ता सम्बन्धित स्थानीय तहको वडा कार्यालयमा गर्नुपर्छ। ' +
      '३५ दिनभित्र दर्ता गरे निःशुल्क हुन्छ।',
    eligibilityEn:
      'The father, mother, or head of the household may register. If none is available, ' +
      'another close relative or guardian may apply.',
    feeAmount: 0,
    feeNote: 'Free if registered within 35 days of birth. A late fee may apply after that — amount not yet confirmed.',
    feeSourceId: srcBirth.id,
    durationTypical: 'Usually the same day, at the counter',
    legalBasis: 'Civil Registration and Vital Statistics legislation',
    published: false,     // not yet field-confirmed — see the quality gate
    sort: 10,
  }).onConflictDoNothing().returning()

  if (birth) {
    const donidcr = deptId.get('Department of National ID and Civil Registration')
    if (donidcr) {
      await db.insert(serviceAgency).values({
        serviceId: birth.id, agencyId: donidcr, role: 'primary',
      }).onConflictDoNothing()
    }

    const STEPS: [string, string, string][] = [
      ['Go to your ward office', 'जाऊ वडा कार्यालय',
       'The ward office of the local government where the birth happened, or where the family normally lives.'],
      ['Fill the registration form', 'फारम भर्नुहोस्',
       'The form is provided at the counter. Bring the details of both parents exactly as they appear on their citizenship certificates.'],
      ['Submit documents for checking', 'कागजात बुझाउनुहोस्',
       'The ward secretary checks the documents and the informant’s identity.'],
      ['Collect the birth certificate', 'जन्म दर्ता प्रमाणपत्र लिनुहोस्',
       'Usually issued the same day. Check every spelling before you leave the counter — correcting it later is far harder.'],
    ]
    let pos = 0
    for (const [en, ne, detail] of STEPS) {
      await db.insert(serviceStep).values({
        serviceId: birth.id, position: (pos += 1),
        titleEn: en, titleNe: ne, detailEn: detail,
      })
    }

    const DOCS: [string, string, boolean, string | null][] = [
      ['Hospital birth record or midwife’s note', 'अस्पतालको जन्म प्रमाण', false,
       'If the birth was at home, a ward-level confirmation may be used instead.'],
      ['Citizenship certificate of the father', 'बुबाको नागरिकता', false, 'Original and one copy.'],
      ['Citizenship certificate of the mother', 'आमाको नागरिकता', false, 'Original and one copy.'],
      ['Marriage registration certificate of the parents', 'विवाह दर्ता प्रमाणपत्र', false,
       'Asked for by some wards, not all.'],
      ['Citizenship certificate of the informant', 'सूचकको नागरिकता', true,
       'Whoever is registering the birth.'],
    ]
    let dpos = 0
    for (const [en, ne, required, note] of DOCS) {
      await db.insert(serviceDocument).values({
        serviceId: birth.id, position: (dpos += 1),
        nameEn: en, nameNe: ne, required, note,
      })
    }

    await db.insert(fact).values([
      { entityType: 'service', entityId: birth.id, field: 'fee',
        sourceId: srcBirth.id, confidence: 70,
        note: 'Free-within-35-days is well established. The late fee amount is NOT confirmed.' },
      { entityType: 'service', entityId: birth.id, field: 'steps',
        sourceId: srcBirth.id, confidence: 65,
        note: 'Standard procedure. Needs a counter walkthrough at a real ward office before publishing.' },
    ]).onConflictDoNothing()

    console.log(`✓ service "register-a-birth" with ${STEPS.length} steps and ${DOCS.length} documents (unpublished — needs a counter visit)`)
  }

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(agency)
  console.log(`\n✓ done. ${n} agencies in the graph.`)
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
