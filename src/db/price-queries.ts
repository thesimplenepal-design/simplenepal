import { db } from './index'
import { priceItem, priceObservation } from './schema'
import { eq, desc } from 'drizzle-orm'
import { summarise, type Observation, type PriceSummary } from '@/lib/prices'

export type ItemWithPrice = {
  slug: string
  nameEn: string
  nameNe: string | null
  unit: string
  category: string
  noteEn: string | null
  summary: PriceSummary | null
}

/**
 * Every item, with its summary — including the ones with too few observations
 * to publish. Showing "we have not checked this enough times yet" is more useful
 * than hiding the row, and it is the honest state of the archive.
 */
export async function allPrices(): Promise<ItemWithPrice[]> {
  const items = await db.select().from(priceItem).orderBy(priceItem.sort)
  if (items.length === 0) return []

  const obs = await db
    .select({
      itemId: priceObservation.itemId, amount: priceObservation.amount,
      context: priceObservation.context, observedAt: priceObservation.observedAt,
      placeNote: priceObservation.placeNote, note: priceObservation.note,
      observedBy: priceObservation.observedBy,
    })
    .from(priceObservation)
    .orderBy(desc(priceObservation.observedAt))

  const byItem = new Map<number, Observation[]>()
  for (const o of obs) {
    const arr = byItem.get(o.itemId) ?? []
    arr.push(o as Observation)
    byItem.set(o.itemId, arr)
  }

  return items.map((it) => ({
    slug: it.slug, nameEn: it.nameEn, nameNe: it.nameNe, unit: it.unit,
    category: it.category, noteEn: it.noteEn,
    summary: summarise(byItem.get(it.id) ?? []),
  }))
}

export async function itemsForEntry() {
  return db.select({ id: priceItem.id, slug: priceItem.slug, nameEn: priceItem.nameEn, unit: priceItem.unit })
    .from(priceItem).orderBy(priceItem.sort)
}

export async function recentObservations(limit = 15) {
  return db
    .select({
      amount: priceObservation.amount, context: priceObservation.context,
      observedAt: priceObservation.observedAt, placeNote: priceObservation.placeNote,
      name: priceItem.nameEn,
    })
    .from(priceObservation)
    .innerJoin(priceItem, eq(priceItem.id, priceObservation.itemId))
    .orderBy(desc(priceObservation.id))
    .limit(limit)
}
