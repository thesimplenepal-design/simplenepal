/**
 * Services a foreign visitor actually needs.
 *
 *   npm run seed:visitor
 *
 * Sourcing note, because this is the part that matters:
 *
 * Search for "Nepal visa on arrival" or "Nepal trekking permit" and nearly every
 * result is a trekking agency's blog. They sell guided treks. They are not lying,
 * but they have an interest in how the rules are described, and none of them tell
 * you when they last checked or where the number came from.
 *
 * So every figure below is taken from an official publisher — Nepal Tourism Board
 * or a Department of Immigration office — and carries that source. Where the
 * official page itself is undated (the protected-area fee PDF), the entry says so
 * and stays a draft rather than pretending to a precision we don't have.
 */
import 'dotenv/config'
import { db } from './index'
import {
  service, serviceStep, serviceDocument, serviceAgency, agency, source, fact,
} from './schema'
import { eq, sql } from 'drizzle-orm'

const BY = 'Sanjog'

/**
 * Insert a service, or fetch it if it already exists.
 *
 * `.onConflictDoNothing().returning()` gives back nothing on a re-run, so
 * guarding the steps/documents/facts behind `if (row)` means a second run
 * silently skips all of them — and any fix made to those rows never lands. That
 * exact shape has now bitten this project twice. Always resolve the row.
 */
async function upsertService(values: typeof service.$inferInsert) {
  const [inserted] = await db.insert(service).values(values).onConflictDoNothing().returning()
  if (inserted) return inserted
  const [existing] = await db.select().from(service).where(eq(service.slug, values.slug)).limit(1)
  return existing ?? null
}

type SourceKind = (typeof source.kind.enumValues)[number]
async function upsertSource(v: { kind: SourceKind; label: string; url?: string }) {
  const [existing] = await db.select().from(source).where(eq(source.label, v.label)).limit(1)
  if (existing) return existing
  const [row] = await db.insert(source).values(v).returning()
  return row
}

async function main() {
  // ── sources ─────────────────────────────────────────────────────────
  const srcNtbVisa = await upsertSource({
    kind: 'official',
    label: 'Nepal Tourism Board — tourist visa fees and gratis categories',
    url: 'https://ntb.gov.np/plan-your-trip/before-you-come/tourist-visa',
  })

  const srcImmExtend = await upsertSource({
    kind: 'official',
    label: 'Department of Immigration (Pokhara office) — tourist visa extension fees and the 150-day annual limit',
    url: 'https://pokhara.immigration.gov.np/en/page/tourist-visa-extension',
  })

  const srcTims = await upsertSource({
    kind: 'official',
    label: 'Nepal Tourism Board — TIMS card fee and the licensed-guide provision effective 31 March 2023',
    url: 'https://ntb.gov.np/plan-your-trip/before-you-come/tims-card',
  })

  const srcParks = await upsertSource({
    kind: 'official',
    label: 'Nepal Tourism Board — "Entrance Fees to Protected Areas" (official PDF, NO PUBLICATION DATE SHOWN — confirm before publishing)',
    url: 'https://trade.ntb.gov.np/wp-content/uploads/2013/08/Entrance-Fees-to-Protected-Areas.pdf',
  })

  const [immigration] = await db.select().from(agency)
    .where(eq(agency.slug, 'department-of-immigration')).limit(1)

  // ── visa on arrival ─────────────────────────────────────────────────
  const visa = await upsertService({
    slug: 'tourist-visa-on-arrival',
    nameEn: 'Get a tourist visa on arrival',
    nameNe: 'आगमनमा पर्यटक भिसा',
    category: 'visitor',
    summaryEn:
      'Most nationalities can get a Nepali tourist visa at the airport or a land border, ' +
      'without applying in advance. It costs USD 30, 50 or 125 depending on how long you ' +
      'want, and every one of them allows multiple entries.',
    eligibilityEn:
      'Most nationalities. A small number of countries must obtain a visa before travelling ' +
      'and cannot get one on arrival — check with a Nepali diplomatic mission if you are ' +
      'unsure, because being turned back at the airport is expensive.',
    feeAmount: 30,
    feeNote:
      'USD 30 for 15 days, USD 50 for 30 days, USD 125 for 90 days — or the equivalent in ' +
      'convertible currency. All three include multiple entry. Free for: children under 10 ' +
      '(except US citizens), SAARC nationals except Afghans on a first visit in the visa ' +
      'year for up to 30 days, NRN card holders, and Chinese nationals.',
    feeSourceId: srcNtbVisa.id,
    durationTypical: 'Issued at the counter, usually under an hour',
    onlineUrl: 'https://nepaliport.immigration.gov.np/',
    published: false,          // needs someone to actually walk through it — see below
    sort: 10,
  })

  if (visa) {
    await db.insert(serviceDocument).values([
      { serviceId: visa.id, nameEn: 'Passport valid at least six months', required: true, position: 1,
        note: 'Checked at the counter. If it expires sooner, you will be refused.' },
      { serviceId: visa.id, nameEn: 'Passport-size photograph', required: true, position: 2,
        note: 'Bring one. The airport kiosks photograph you, but a spare avoids a queue if they are down.' },
      { serviceId: visa.id, nameEn: 'The fee, in cash', required: true, position: 3,
        note: 'USD or another convertible currency. Card machines exist but fail often — cash is the reliable option, and small notes help.' },
      { serviceId: visa.id, nameEn: 'Address in Nepal', required: true, position: 4,
        note: 'Your first hotel is fine.' },
      { serviceId: visa.id, nameEn: 'Online application receipt', required: false, position: 5,
        note: 'If you filled the form in advance, bring the printout or a screenshot — it skips the kiosk step.' },
    ]).onConflictDoUpdate({
      target: [serviceDocument.serviceId, serviceDocument.position],
      set: { nameEn: sql`excluded.name_en`, nameNe: sql`excluded.name_ne`,
             note: sql`excluded.note`, required: sql`excluded.required` },
    })

    await db.insert(serviceStep).values([
      { serviceId: visa.id, position: 1, titleEn: 'Fill the arrival form',
        detailEn: 'Either online up to 15 days before you fly, or at a kiosk in the arrivals hall. Doing it beforehand saves the longest queue.' },
      { serviceId: visa.id, position: 2, titleEn: 'Pay the fee',
        detailEn: 'At the bank counter in the arrivals hall. Keep the receipt — the immigration desk asks for it.' },
      { serviceId: visa.id, position: 3, titleEn: 'Queue at immigration',
        detailEn: 'Hand over passport, photo and payment receipt. Fingerprints are taken here.' },
      { serviceId: visa.id, position: 4, titleEn: 'Check the sticker before you walk away',
        detailEn: 'Confirm the number of days matches what you paid for. Fixing it later means a trip to the Department of Immigration in Kathmandu.' },
    ]).onConflictDoUpdate({
      target: [serviceStep.serviceId, serviceStep.position],
      set: { titleEn: sql`excluded.title_en`, titleNe: sql`excluded.title_ne`,
             detailEn: sql`excluded.detail_en` },
    })

    await db.insert(fact).values({
      entityType: 'service', entityId: visa.id, field: 'fee',
      sourceId: srcNtbVisa.id, confidence: 85,
      note: 'Nepal Tourism Board published figures. Not yet confirmed at an airport counter by us.',
    }).onConflictDoNothing()

    if (immigration) {
      await db.insert(serviceAgency).values({
        serviceId: visa.id, agencyId: immigration.id, role: 'primary',
      }).onConflictDoNothing()
    }
  }

  // ── visa extension ──────────────────────────────────────────────────
  const extend = await upsertService({
    slug: 'extend-a-tourist-visa',
    nameEn: 'Extend a tourist visa',
    nameNe: 'पर्यटक भिसा म्याद थप',
    category: 'visitor',
    summaryEn:
      'You can extend a tourist visa for a minimum of 15 days at a time, up to a total of ' +
      '150 days in one visa year. Done at the Department of Immigration in Kathmandu or the ' +
      'office in Pokhara.',
    eligibilityEn: 'Anyone holding a valid Nepali tourist visa that has not yet expired.',
    feeAmount: 45,
    feeNote:
      'USD 45 for the first 15 days, then USD 3 for each additional day. Extending after ' +
      'your visa has already expired attracts a late fee on top, so go before it runs out.',
    feeSourceId: srcImmExtend.id,
    durationTypical: 'Same day if you arrive early',
    onlineUrl: 'https://nepaliport.immigration.gov.np/',
    published: false,
    sort: 20,
  })

  if (extend) {
    await db.insert(serviceDocument).values([
      { serviceId: extend.id, nameEn: 'Passport with the current Nepali visa', required: true, position: 1 },
      { serviceId: extend.id, nameEn: 'Online extension application receipt', required: true, position: 2,
        note: 'The form is filled online first; the office processes the printout.' },
      { serviceId: extend.id, nameEn: 'The fee', required: true, position: 3,
        note: 'Payable at the office. Check on the day whether they want cash or card.' },
    ]).onConflictDoUpdate({
      target: [serviceDocument.serviceId, serviceDocument.position],
      set: { nameEn: sql`excluded.name_en`, nameNe: sql`excluded.name_ne`,
             note: sql`excluded.note`, required: sql`excluded.required` },
    })

    await db.insert(serviceStep).values([
      { serviceId: extend.id, position: 1, titleEn: 'Apply online',
        detailEn: 'Fill the extension form on the Department of Immigration portal and print the receipt.' },
      { serviceId: extend.id, position: 2, titleEn: 'Go to the immigration office',
        detailEn: 'Kathmandu (Kalikasthan) or Pokhara. Arrive early — the queue builds through the morning.' },
      { serviceId: extend.id, position: 3, titleEn: 'Pay and collect',
        detailEn: 'Usually returned the same day. Check the new expiry date on the sticker before leaving.' },
    ]).onConflictDoUpdate({
      target: [serviceStep.serviceId, serviceStep.position],
      set: { titleEn: sql`excluded.title_en`, titleNe: sql`excluded.title_ne`,
             detailEn: sql`excluded.detail_en` },
    })

    await db.insert(fact).values({
      entityType: 'service', entityId: extend.id, field: 'fee',
      sourceId: srcImmExtend.id, confidence: 85,
      note: 'Published by the Department of Immigration Pokhara office. Not yet confirmed at a counter by us.',
    }).onConflictDoNothing()

    if (immigration) {
      await db.insert(serviceAgency).values({
        serviceId: extend.id, agencyId: immigration.id, role: 'primary',
      }).onConflictDoNothing()
    }
  }

  // ── trekking permits ────────────────────────────────────────────────
  const trek = await upsertService({
    slug: 'trekking-permits',
    nameEn: 'Get trekking permits',
    nameNe: 'पदयात्रा अनुमतिपत्र',
    category: 'visitor',
    summaryEn:
      'Almost every trek in Nepal needs two things: a TIMS card, and an entry permit for the ' +
      'national park or conservation area you are walking into. They are separate, bought in ' +
      'different places, and neither substitutes for the other.',
    eligibilityEn:
      'All foreign trekkers. Since 31 March 2023 the Nepal Tourism Board provision requires ' +
      'trekkers in specific protected areas to be accompanied by a licensed guide and to carry ' +
      'a TIMS card issued through a trekking agency.',
    feeAmount: 2000,
    feeNote:
      'TIMS card: NPR 2,000 for most nationalities, NPR 1,000 for SAARC nationals, paid online. ' +
      'Park and conservation entry is separate — Annapurna, Manaslu and Gaurishankar are ' +
      'NPR 2,000 for foreigners, Sagarmatha and Langtang NPR 3,000, and Chitwan NPR 1,500 per day.',
    feeSourceId: srcTims.id,
    durationTypical: 'Same day',
    onlineUrl: 'https://tims.ntb.gov.np/',
    published: false,
    sort: 30,
  })

  if (trek) {
    await db.insert(serviceDocument).values([
      { serviceId: trek.id, nameEn: 'Passport and a copy of your Nepali visa', required: true, position: 1 },
      { serviceId: trek.id, nameEn: 'Passport-size photographs', required: true, position: 2,
        note: 'Bring several. Different permits ask for their own.' },
      { serviceId: trek.id, nameEn: 'Insurance details', required: false, position: 3,
        note: 'Asked for on some forms. Bring the policy number and the emergency line — helicopter evacuation is expensive without it.' },
      { serviceId: trek.id, nameEn: 'Your itinerary and entry/exit points', required: true, position: 4 },
    ]).onConflictDoUpdate({
      target: [serviceDocument.serviceId, serviceDocument.position],
      set: { nameEn: sql`excluded.name_en`, nameNe: sql`excluded.name_ne`,
             note: sql`excluded.note`, required: sql`excluded.required` },
    })

    await db.insert(serviceStep).values([
      { serviceId: trek.id, position: 1, titleEn: 'Work out which protected area your route enters',
        detailEn: 'This decides the entry permit and its cost. A route can cross more than one, and each is charged separately.' },
      { serviceId: trek.id, position: 2, titleEn: 'Get the TIMS card',
        detailEn: 'Issued online through a registered trekking agency, which generates a QR eCard for each trekker.' },
      { serviceId: trek.id, position: 3, titleEn: 'Buy the park or conservation entry permit',
        detailEn: 'From the Nepal Tourism Board offices in Kathmandu or Pokhara, or at the park entry point on some routes. Buying in the city is usually cheaper and always less stressful.' },
      { serviceId: trek.id, position: 4, titleEn: 'Carry both, and keep them dry',
        detailEn: 'They are checked at posts along the trail. A photo on your phone is not accepted at every checkpoint.' },
    ]).onConflictDoUpdate({
      target: [serviceStep.serviceId, serviceStep.position],
      set: { titleEn: sql`excluded.title_en`, titleNe: sql`excluded.title_ne`,
             detailEn: sql`excluded.detail_en` },
    })

    // Two different fees from two different documents, so two different field
    // names. `fact` has a unique index on (entity, field) — one current value
    // per field — so filing both as 'fee' silently drops the second, and the
    // weaker source is exactly the one a reader most needs to see.
    await db.insert(fact).values([
      { entityType: 'service', entityId: trek.id, field: 'fee_tims',
        sourceId: srcTims.id, confidence: 85,
        note: 'TIMS card fee and the licensed-guide provision, published by Nepal Tourism Board.' },
      { entityType: 'service', entityId: trek.id, field: 'fee_park',
        sourceId: srcParks.id, confidence: 60,
        note: 'Protected-area entry fees come from an official Nepal Tourism Board PDF that carries NO publication date. The figures may be out of date — confirm at an NTB counter before publishing.' },
      { entityType: 'service', entityId: trek.id, field: 'guide_rule',
        sourceId: srcTims.id, confidence: 85,
        note: 'The requirement to be accompanied by a licensed guide in specific protected areas took effect 31 March 2023, per Nepal Tourism Board.' },
    ]).onConflictDoNothing()
  }

  const n = [visa, extend, trek].filter(Boolean).length
  console.log(`✓ ${n} visitor services present (all unpublished — see the sourcing note in this file)`)
  console.log('  · tourist-visa-on-arrival — NTB published fees, confidence 85')
  console.log('  · extend-a-tourist-visa   — Dept of Immigration published fees, confidence 85')
  console.log('  · trekking-permits        — TIMS confidence 85, park fees confidence 60 (undated PDF)')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
