/**
 * The things a visitor most often overpays for.
 *
 *   npm run seed:prices
 *
 * This seeds the ITEMS only — the questions. It deliberately seeds no prices,
 * because a price nobody has actually observed is exactly the kind of confident
 * invention this whole site exists to avoid. Sanjog observes them at
 * /prices/entry, three times each, and the page publishes when the gate is met.
 *
 * Fifteen items, not five hundred. The same rule as everything else here.
 */
import 'dotenv/config'
import { db } from './index'
import { priceItem } from './schema'
import { sql } from 'drizzle-orm'

type Item = { slug: string; nameEn: string; nameNe?: string; unit: string
              category: string; noteEn?: string }

const ITEMS: Item[] = [
  // ── getting from the airport, where most first impressions are formed ──
  { slug: 'taxi-airport-thamel', nameEn: 'Taxi, airport to Thamel', nameNe: 'ट्याक्सी, विमानस्थल–ठमेल',
    unit: 'per ride', category: 'transport',
    noteEn: 'The prepaid counter inside arrivals and a taxi flagged outside are usually different prices. Both are recorded.' },
  { slug: 'taxi-airport-patan', nameEn: 'Taxi, airport to Patan', unit: 'per ride', category: 'transport' },
  { slug: 'pathao-bike-5km', nameEn: 'Pathao / inDrive bike, about 5 km', unit: 'per ride', category: 'transport',
    noteEn: 'App fares move with demand. Recorded at an ordinary time of day, not in rain or rush hour.' },
  { slug: 'taxi-thamel-patan', nameEn: 'Taxi, Thamel to Patan', unit: 'per ride', category: 'transport' },
  { slug: 'bus-kathmandu-pokhara-tourist', nameEn: 'Tourist bus, Kathmandu to Pokhara',
    unit: 'per seat', category: 'transport' },

  // ── the first hour: connectivity and money ──
  { slug: 'sim-tourist-30day-data', nameEn: 'Tourist SIM with 30 days of data', nameNe: 'पर्यटक सिम',
    unit: 'per SIM', category: 'essentials',
    noteEn: 'A passport is required by law to register any SIM in Nepal. Nobody can sell you one without it.' },
  { slug: 'atm-withdrawal-fee', nameEn: 'ATM withdrawal fee', unit: 'per withdrawal', category: 'essentials',
    noteEn: 'Charged by the Nepali bank, on top of anything your own bank takes. Withdraw larger amounts less often.' },

  // ── eating and drinking, where the local/tourist gap is widest ──
  { slug: 'dal-bhat-local', nameEn: 'Dal bhat, ordinary local restaurant', nameNe: 'दालभात',
    unit: 'per plate', category: 'food' },
  { slug: 'momo-plate', nameEn: 'Momo, plate of ten', nameNe: 'मम',
    unit: 'per plate', category: 'food' },
  { slug: 'water-1l', nameEn: 'Bottled water, 1 litre', unit: 'per bottle', category: 'food',
    noteEn: 'Shops and hotel minibars are not the same market. Both are recorded.' },
  { slug: 'milk-tea', nameEn: 'Milk tea', nameNe: 'दूध चिया', unit: 'per glass', category: 'food' },
  { slug: 'coffee-cafe', nameEn: 'Coffee at a cafe', unit: 'per cup', category: 'food' },
  { slug: 'beer-660ml-restaurant', nameEn: 'Beer, 660 ml, in a restaurant', unit: 'per bottle', category: 'food' },

  // ── staying and doing ──
  { slug: 'guesthouse-double-thamel', nameEn: 'Guesthouse double room, Thamel',
    unit: 'per night', category: 'stay',
    noteEn: 'Off-season and high-season differ enormously. The observation date matters more here than anywhere else.' },
  { slug: 'trekking-guide-day', nameEn: 'Licensed trekking guide', unit: 'per day', category: 'doing',
    noteEn: 'Ask what is included — food and lodging for the guide is usually on top, and should be said out loud before you set off.' },
  { slug: 'porter-day', nameEn: 'Porter', unit: 'per day', category: 'doing',
    noteEn: 'There are legal load limits and they exist for good reason. Paying less than the going rate is not a saving worth making.' },
]

async function main() {
  await db.insert(priceItem).values(
    ITEMS.map((it, i) => ({
      slug: it.slug, nameEn: it.nameEn, nameNe: it.nameNe ?? null,
      unit: it.unit, category: it.category, noteEn: it.noteEn ?? null,
      sort: (i + 1) * 10,
    })),
  ).onConflictDoUpdate({
    target: priceItem.slug,
    set: {
      nameEn: sql`excluded.name_en`, nameNe: sql`excluded.name_ne`,
      unit: sql`excluded.unit`, category: sql`excluded.category`,
      noteEn: sql`excluded.note_en`, sort: sql`excluded.sort`,
    },
  })

  console.log(`✓ ${ITEMS.length} price items seeded — and deliberately zero prices.`)
  console.log('  Observe them at /prices/entry. Three observations each before anything publishes.')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
