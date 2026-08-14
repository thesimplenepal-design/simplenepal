/**
 * Seeds Nepal's administrative spine: 7 provinces → 77 districts → 753 local
 * levels (6,743 wards). This is free, authoritative, and gives us a complete
 * national skeleton before a single field visit.
 *
 * Source: github.com/sagautam5/local-states-nepal (MIT), which mirrors the
 * official federal restructuring data. Bilingual throughout.
 *
 *   npm run seed:admin
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { db } from './index'
import { province, district, localLevel } from './schema'
import { slugify } from '../lib/np'

const DIR = join(process.cwd(), 'data-src')
const read = (p: string) => JSON.parse(readFileSync(join(DIR, p), 'utf8'))

const KIND: Record<number, 'metropolitan' | 'sub_metropolitan' | 'municipality' | 'rural_municipality'> = {
  1: 'metropolitan',
  2: 'sub_metropolitan',
  3: 'municipality',
  4: 'rural_municipality',
}

/** Devanagari numerals appear in the np dataset; parse both. */
function num(v: unknown): number | null {
  if (v == null) return null
  const s = String(v).replace(/[०-९]/g, (d) => '०१२३४५६७८९'.indexOf(d).toString())
  const n = parseFloat(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

async function main() {
  const pEn = read('provinces/en.json'), pNe = read('provinces/np.json')
  const dEn = read('districts/en.json'), dNe = read('districts/np.json')
  const mEn = read('municipalities/en.json'), mNe = read('municipalities/np.json')

  type NeRow = { id: number; name: string; headquarter?: string }
  const neBy = (rows: NeRow[]) => new Map<number, NeRow>(rows.map((r) => [r.id, r]))
  const pNeMap = neBy(pNe), dNeMap = neBy(dNe), mNeMap = neBy(mNe)

  console.log(`provinces ${pEn.length} · districts ${dEn.length} · local levels ${mEn.length}`)

  await db.insert(province).values(pEn.map((p: any) => ({
    id: p.id,
    slug: slugify(p.name),
    nameEn: p.name,
    nameNe: pNeMap.get(p.id)?.name ?? p.name,
    hqEn: p.headquarter ?? null,
    hqNe: pNeMap.get(p.id)?.headquarter ?? null,
    areaSqKm: num(p.area_sq_km),
    website: p.website ?? null,
  }))).onConflictDoNothing()

  await db.insert(district).values(dEn.map((d: any) => ({
    id: d.id,
    provinceId: d.province_id,
    slug: slugify(d.name),
    nameEn: d.name,
    nameNe: dNeMap.get(d.id)?.name ?? d.name,
    hqEn: d.headquarter ?? null,
    hqNe: dNeMap.get(d.id)?.headquarter ?? null,
    areaSqKm: num(d.area_sq_km),
    website: d.website ?? null,
  }))).onConflictDoNothing()

  await db.insert(localLevel).values(mEn.map((m: any) => ({
    id: m.id,
    districtId: m.district_id,
    slug: slugify(m.name),
    nameEn: m.name,
    nameNe: mNeMap.get(m.id)?.name ?? m.name,
    kind: KIND[m.category_id] ?? 'rural_municipality',
    wards: Number(m.wards) || 0,
    areaSqKm: num(m.area_sq_km),
    website: m.website ?? null,
  }))).onConflictDoNothing()

  const wards = mEn.reduce((s: number, m: any) => s + (Number(m.wards) || 0), 0)
  console.log(`✓ seeded. total wards: ${wards}`)
  if (wards !== 6743) console.warn(`⚠ expected 6,743 wards, got ${wards} — check the source data`)
  process.exit(0)
}

main().catch((e) => { console.error(e); process.exit(1) })
