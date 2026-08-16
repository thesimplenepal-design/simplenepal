/**
 * Import a register as a WORKLIST.
 *
 *   npm run import:csv -- colleges path/to/ugc-colleges.csv "UGC"
 *   npm run import:csv -- health   path/to/nhfr-export.csv   "NHFR"
 *
 * Why a CSV importer and not a scraper:
 *
 * The last time something here was written against a source that could not be
 * seen from the machine writing it, the result was a parser that read 61 pages
 * of pagination and wrote zero rows, because the documentation said `ISO3` and
 * the live API said `iso3`. Guessing at somebody's HTML is the same mistake with
 * more moving parts. Export or download the register, look at the columns, then
 * run this.
 *
 * Everything imported is a LISTING, never a verification:
 *   · registryName is set, verifiedAt stays null
 *   · the quality gate leaves it unpublished — no photo, no coordinates, no visitor
 *   · it shows on the directory as "listed in the X register", not as checked
 *
 * The value is not the rows. It is that you now have a named, placed list of
 * real things to go and verify, with the boring part already done.
 *
 * Expected columns (case-insensitive, extras ignored, order irrelevant):
 *   colleges: name, district, affiliation, type, established, code, address
 *   health:   name, district, kind, ownership, beds, emergency, code, address
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { db } from './index'
import {
  organisation, institution, healthFacility, source, district,
} from './schema'
import { eq, sql, ilike } from 'drizzle-orm'
import { slugify, nameKey } from '../lib/np'
import { parseCsv, type Row } from '../lib/csv'

const pick = (r: Row, ...names: string[]) => {
  for (const n of names) if (r[n]) return r[n]
  return ''
}

const yes = (v: string) => /^(y|yes|true|1|available)$/i.test(v.trim())

async function main() {
  const [kind, file, registryRaw] = process.argv.slice(2)
  if (!kind || !file || !['colleges', 'health'].includes(kind)) {
    console.error('Usage: npm run import:csv -- <colleges|health> <file.csv> [registryName]')
    process.exit(1)
  }
  const registry = (registryRaw || (kind === 'colleges' ? 'UGC' : 'NHFR')).slice(0, 40)

  const rows = parseCsv(readFileSync(file, 'utf8'))
  if (rows.length === 0) { console.error('No rows found. Check the file has a header line.'); process.exit(1) }

  console.log(`Read ${rows.length} rows. Columns seen: ${Object.keys(rows[0]).join(', ')}\n`)
  if (!pick(rows[0], 'name', 'institution', 'facility', 'college')) {
    console.error('No "name" column found. Rename the column to `name` and try again.')
    process.exit(1)
  }

  const label = `${registry} register — imported list, not visited by us`
  let [src] = await db.select().from(source).where(eq(source.label, label)).limit(1)
  if (!src) [src] = await db.insert(source).values({ kind: 'official', label }).returning()

  const districts = await db.select({ id: district.id, name: district.nameEn }).from(district)
  const dIndex = new Map(districts.map((d) => [d.name.toLowerCase(), d.id]))

  const now = new Date()
  let done = 0, skipped = 0, unplaced = 0

  for (const r of rows) {
    const name = pick(r, 'name', 'institution', 'facility', 'college')
    if (!name) { skipped++; continue }

    const dName = pick(r, 'district').toLowerCase()
    const districtId = dIndex.get(dName) ?? null
    if (!districtId && dName) unplaced++

    const [org] = await db.insert(organisation).values({
      slug: slugify(`${name} ${pick(r, 'district')}`.trim()),
      nameEn: name,
      nameKey: nameKey(name),
      registryName: registry,
      registryId: pick(r, 'code', 'id', 'registry_id') || null,
      registryCheckedAt: now,
      published: false,           // the gate would refuse anyway; be explicit
    }).onConflictDoUpdate({
      target: organisation.slug,
      set: {
        nameEn: sql`excluded.name_en`, registryName: sql`excluded.registry_name`,
        registryId: sql`excluded.registry_id`,
        registryCheckedAt: sql`excluded.registry_checked_at`, updatedAt: now,
      },
    }).returning()
    if (!org) { skipped++; continue }

    if (kind === 'colleges') {
      const affil = pick(r, 'affiliation', 'affiliated_to', 'university')
      let affiliatedToId: number | null = null
      if (affil) {
        const [u] = await db.select({ id: organisation.id }).from(organisation)
          .where(ilike(organisation.nameEn, `%${affil}%`)).limit(1)
        affiliatedToId = u?.id ?? null
      }
      await db.insert(institution).values({
        organisationId: org.id,
        kind: 'college',
        affiliatedToId,
        affiliationType: pick(r, 'type', 'affiliation_type') || null,
        establishedYear: Number(pick(r, 'established', 'estd')) || null,
        ugcCode: pick(r, 'code') || null,
        sourceId: src?.id ?? null,
      }).onConflictDoNothing()
    } else {
      const k = pick(r, 'kind', 'type', 'level').toLowerCase()
      const own = pick(r, 'ownership', 'owner').toLowerCase()
      await db.insert(healthFacility).values({
        organisationId: org.id,
        kind: k.includes('teach') ? 'teaching_hospital'
          : k.includes('hospital') ? 'hospital'
          : k.includes('primary') ? 'primary_health_centre'
          : k.includes('post') ? 'health_post' : 'clinic',
        ownership: own.includes('gov') ? 'government'
          : own.includes('commun') ? 'community'
          : own.includes('teach') ? 'teaching'
          : own.includes('ngo') ? 'ngo' : 'private',
        beds: Number(pick(r, 'beds')) || null,
        // Absent is NOT false here. "We do not know if it takes emergencies" and
        // "it does not take emergencies" are very different things to publish.
        hasEmergency: pick(r, 'emergency') ? yes(pick(r, 'emergency')) : null,
        sourceId: src?.id ?? null,
      }).onConflictDoNothing()
    }
    done++
  }

  console.log(`✓ ${done} listed from the ${registry} register${skipped ? `, ${skipped} skipped` : ''}`)
  if (unplaced) console.log(`  ${unplaced} had a district we could not match — check the spelling in your CSV`)
  console.log('\n  Every one is UNVERIFIED and UNPUBLISHED. This is a worklist, not content.')
  console.log('  They will show on the directory as register listings until someone visits them.')
}


main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
