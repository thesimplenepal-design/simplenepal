/**
 * The starting taxonomy. Deliberately small.
 *
 * The plan says: spine + ONE deep category. Food & lodging is the right first
 * category because it is the one Sanjog can verify honestly while travelling,
 * it is where inbound tourists and domestic users overlap, and it is the
 * category most likely to actually pay for a listing.
 *
 * Do not add categories because they seem obvious. Add one when you have
 * twenty verified records ready to fill it.
 */
import 'dotenv/config'
import { db } from './index'
import { category } from './schema'

const ROOTS = [
  { slug: 'food-drink', nameEn: 'Food & Drink', nameNe: 'खाना र पेय', schemaType: 'FoodEstablishment', sort: 10 },
  { slug: 'stay',       nameEn: 'Places to Stay', nameNe: 'बस्ने ठाउँ', schemaType: 'LodgingBusiness', sort: 20 },
]

const CHILDREN: Record<string, { slug: string; nameEn: string; nameNe: string; schemaType: string }[]> = {
  'food-drink': [
    { slug: 'restaurant', nameEn: 'Restaurant',  nameNe: 'रेस्टुरेन्ट', schemaType: 'Restaurant' },
    { slug: 'cafe',       nameEn: 'Café',        nameNe: 'क्याफे',      schemaType: 'CafeOrCoffeeShop' },
    { slug: 'sekuwa',     nameEn: 'Sekuwa & Grill', nameNe: 'सेकुवा',   schemaType: 'Restaurant' },
    { slug: 'newari',     nameEn: 'Newari Food', nameNe: 'नेवारी खाना', schemaType: 'Restaurant' },
    { slug: 'sweets',     nameEn: 'Sweets & Bakery', nameNe: 'मिठाई र बेकरी', schemaType: 'Bakery' },
    { slug: 'bar',        nameEn: 'Bar & Pub',   nameNe: 'बार',        schemaType: 'BarOrPub' },
  ],
  'stay': [
    { slug: 'hotel',     nameEn: 'Hotel',      nameNe: 'होटल',       schemaType: 'Hotel' },
    { slug: 'guesthouse',nameEn: 'Guest House',nameNe: 'गेस्ट हाउस', schemaType: 'BedAndBreakfast' },
    { slug: 'homestay',  nameEn: 'Homestay',   nameNe: 'होमस्टे',    schemaType: 'BedAndBreakfast' },
    { slug: 'resort',    nameEn: 'Resort',     nameNe: 'रिसोर्ट',    schemaType: 'Resort' },
    { slug: 'lodge',     nameEn: 'Lodge / Teahouse', nameNe: 'लज', schemaType: 'Hotel' },
  ],
}

async function main() {
  for (const r of ROOTS) {
    const [row] = await db.insert(category).values(r)
      .onConflictDoUpdate({ target: category.slug, set: { nameEn: r.nameEn } })
      .returning()
    const kids = CHILDREN[r.slug] ?? []
    let sort = 0
    for (const k of kids) {
      await db.insert(category).values({ ...k, parentId: row.id, sort: (sort += 10) })
        .onConflictDoNothing()
    }
    console.log(`✓ ${r.nameEn} (+${kids.length})`)
  }
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
