import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { organisation, location, media, fact, source } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { nameKey, slugify, geohash } from '@/lib/np'
import { scoreOrganisation } from '@/lib/quality'
import { putPhoto } from '@/lib/storage'
import { revalidatePath } from 'next/cache'

export const runtime = 'nodejs'

/**
 * One capture = one organisation + one location + N photos + provenance rows.
 *
 * Photos go through lib/storage.ts — Vercel Blob in production, local disk in
 * dev, so `npm run dev` needs no tokens.
 */
export async function POST(req: Request) {
  if ((await cookies()).get('sn_admin')?.value !== 'ok') {
    return new NextResponse('unauthorised', { status: 401 })
  }

  const b = await req.json()
  if (!b.nameEn?.trim()) return new NextResponse('name required', { status: 400 })

  const now = new Date()
  const by = 'Sanjog'
  const key = nameKey(b.nameEn)
  const localLevelId = b.localLevelId ? Number(b.localLevelId) : null

  // Dedup is ADVISORY. The name key is deliberately lossy, and Nepal genuinely
  // has three Hotel Namastes in one municipality — so we surface the collision
  // and let the operator decide, rather than refusing the save.
  if (localLevelId && !b.force) {
    const dup = await db
      .select({ id: organisation.id, slug: organisation.slug })
      .from(organisation)
      .innerJoin(location, eq(location.organisationId, organisation.id))
      .where(and(eq(organisation.nameKey, key), eq(location.localLevelId, localLevelId)))
      .limit(1)
    if (dup.length) {
      return NextResponse.json(
        {
          error: 'possible_duplicate',
          slug: dup[0].slug,
          message: 'A place with a very similar name is already recorded here.',
        },
        { status: 409 },
      )
    }
  }

  // Slug must be globally unique; disambiguate with a counter, never a random suffix.
  let slug = slugify(b.nameEn)
  for (let n = 2; ; n++) {
    const taken = await db.select({ id: organisation.id }).from(organisation)
      .where(eq(organisation.slug, slug)).limit(1)
    if (!taken.length) break
    slug = `${slugify(b.nameEn)}-${n}`
  }

  const [src] = await db.insert(source).values({
    kind: 'field_visit',
    label: b.sourceNote?.trim() || `Field visit by ${by}`,
    capturedAt: now,
  }).returning()

  const hours = buildHours(b.open, b.close, b.closedDay)
  const lat = b.lat ? Number(b.lat) : null
  const lng = b.lng ? Number(b.lng) : null

  const [org] = await db.insert(organisation).values({
    slug,
    nameEn: b.nameEn.trim(),
    nameNe: b.nameNe?.trim() || null,
    nameKey: key,
    categoryId: b.categoryId ? Number(b.categoryId) : null,
    descriptionEn: b.descriptionEn?.trim() || null,
    website: clean(b.website),
    facebook: clean(b.facebook),
    priceLevel: b.priceLevel ? Number(b.priceLevel) : null,
    verifiedAt: now,
    verifiedBy: by,
    qualityScore: 0,
    published: false,
  }).returning()

  await db.insert(location).values({
    organisationId: org.id,
    localLevelId,
    ward: b.ward ? Number(b.ward) : null,
    addressEn: b.addressEn?.trim() || null,
    lat, lng,
    geohash5: lat != null && lng != null ? geohash(lat, lng, 5) : null,
    phones: b.phone?.trim() ? [b.phone.trim()] : null,
    whatsapp: clean(b.whatsapp),
    hours,
    isPrimary: true,
  })

  const photos: string[] = Array.isArray(b.photos) ? b.photos : []
  for (let i = 0; i < photos.length; i++) {
    const url = await putPhoto(photos[i], `${org.id}-${i}`)
    if (!url) continue
    await db.insert(media).values({
      entityType: 'organisation', entityId: org.id, url,
      sort: i, takenAt: now, lat, lng,
    })
  }

  // Provenance: one row per field we actually captured.
  const fields = [
    ['name', !!b.nameEn], ['category', !!b.categoryId], ['geo', lat != null],
    ['phone', !!b.phone], ['hours', !!hours], ['address', !!b.addressEn],
    ['description', !!b.descriptionEn], ['photos', photos.length > 0],
  ] as const
  const rows = fields.filter(([, present]) => present).map(([field]) => ({
    entityType: 'organisation', entityId: org.id, field,
    sourceId: src.id, confidence: 95, verifiedBy: by, verifiedAt: now,
  }))
  if (rows.length) await db.insert(fact).values(rows).onConflictDoNothing()

  // Score and gate. `published` is computed here — never set by hand.
  const q = scoreOrganisation({
    nameEn: org.nameEn, nameNe: org.nameNe, categoryId: org.categoryId,
    descriptionEn: org.descriptionEn, website: org.website, facebook: org.facebook,
    lat, lng, localLevelId, ward: b.ward ? Number(b.ward) : null,
    phones: b.phone ? [b.phone] : [], hours,
    photoCount: photos.length, verifiedAt: now,
  })

  await db.update(organisation)
    .set({ qualityScore: q.score, published: q.publishable, updatedAt: now })
    .where(eq(organisation.id, org.id))

  // On-demand revalidation. Without the sitemap line a newly verified place sits
  // undiscovered until the hourly window rolls over — which is the whole point of
  // having gone there.
  if (q.publishable) {
    revalidatePath(`/biz/${slug}`)
    revalidatePath('/')
    revalidatePath('/sitemap.xml')
    if (localLevelId) revalidatePath('/nepal/[province]/[district]/[local]', 'page')
  }

  return NextResponse.json({ slug, score: q.score, published: q.publishable, missing: q.missing })
}

function clean(v?: string) {
  const s = v?.trim()
  return s ? (s.startsWith('http') || s.includes('@') ? s : `https://${s}`) : null
}

function buildHours(open?: string, close?: string, closedDay?: string) {
  if (!open || !close) return null
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
  const out: Record<string, [string, string][]> = {}
  for (const d of days) out[d] = d === closedDay ? [] : [[open, close]]
  return out
}
