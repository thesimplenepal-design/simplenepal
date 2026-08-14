/**
 * The publish gate.
 *
 * Thin auto-generated pages are how programmatic directories get demoted by
 * Google and never recover. So: nothing is indexable until it earns it, and
 * `published` is computed here rather than set by a human who is in a hurry.
 *
 * The bar is deliberately built around what ONE person on the road can produce:
 * a photo, a pin, a phone number, opening hours, and two sentences they wrote
 * themselves. That is a better page than 95% of Nepali business listings today.
 */

export type QualityInput = {
  nameEn?: string | null
  nameNe?: string | null
  categoryId?: number | null
  descriptionEn?: string | null
  descriptionNe?: string | null
  website?: string | null
  facebook?: string | null
  lat?: number | null
  lng?: number | null
  localLevelId?: number | null
  ward?: number | null
  phones?: string[] | null
  hours?: unknown | null
  photoCount: number
  verifiedAt?: Date | null
}

export type QualityResult = {
  score: number
  publishable: boolean
  breakdown: { key: string; label: string; points: number; max: number }[]
  missing: string[]
}

const FRESHNESS_DAYS = 180

export function scoreOrganisation(i: QualityInput): QualityResult {
  const b: QualityResult['breakdown'] = []
  const add = (key: string, label: string, points: number, max: number) =>
    b.push({ key, label, points, max })

  add('name', 'Name', i.nameEn ? (i.nameNe ? 10 : 7) : 0, 10)
  add('category', 'Category', i.categoryId ? 8 : 0, 8)
  add('place', 'Place & ward', i.localLevelId ? (i.ward ? 8 : 5) : 0, 8)
  add('geo', 'Map pin', i.lat != null && i.lng != null ? 12 : 0, 12)
  add('phone', 'Phone', i.phones?.length ? 12 : 0, 12)
  add('hours', 'Opening hours', i.hours ? 10 : 0, 10)
  add('photo', 'Photos', i.photoCount >= 3 ? 15 : i.photoCount >= 1 ? 10 : 0, 15)

  const desc = (i.descriptionEn ?? '').trim().length
  add('description', 'Description', desc >= 200 ? 10 : desc >= 80 ? 6 : 0, 10)
  add('links', 'Website or social', i.website || i.facebook ? 5 : 0, 5)
  add('verified', 'Field-verified', isFresh(i.verifiedAt) ? 10 : 0, 10)

  const score = b.reduce((s, x) => s + x.points, 0)

  // Hard requirements — a high score cannot buy its way past these.
  const publishable =
    score >= 55 &&
    !!i.nameEn &&
    i.lat != null && i.lng != null &&
    i.photoCount >= 1 &&
    !!i.localLevelId &&
    isFresh(i.verifiedAt)

  const missing = b.filter((x) => x.points < x.max).map((x) => x.label)
  return { score, publishable, breakdown: b, missing }
}

/** Verified records re-confirm within 180 days. A lapsed badge is removed automatically. */
export function isFresh(verifiedAt?: Date | null, days = FRESHNESS_DAYS): boolean {
  if (!verifiedAt) return false
  const ageMs = Date.now() - new Date(verifiedAt).getTime()
  return ageMs < days * 86_400_000
}

export function daysUntilStale(verifiedAt?: Date | null, days = FRESHNESS_DAYS): number | null {
  if (!verifiedAt) return null
  const ageDays = (Date.now() - new Date(verifiedAt).getTime()) / 86_400_000
  return Math.ceil(days - ageDays)
}
