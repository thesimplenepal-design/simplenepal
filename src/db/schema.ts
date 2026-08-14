/**
 * SimpleNepal — the Nepal Graph.
 *
 * Three rules this schema exists to enforce:
 *  1. organisation ≠ location. A business is an identity; a location is a physical
 *     presence. Chains break any model that conflates them, and multi-location is
 *     the Enterprise upsell.
 *  2. Provenance is a first-class table, not a comment. Every published fact can
 *     name its source, its verifier and its date. That is what makes the data
 *     licensable and the Verified badge honest.
 *  3. Nothing publishes below the quality threshold. `published` is computed, never
 *     set by hand.
 */
import {
  pgTable, serial, integer, text, varchar, boolean, timestamp,
  doublePrecision, jsonb, index, uniqueIndex, pgEnum,
} from 'drizzle-orm/pg-core'

// ─────────────────────────────────────────────────────── enums

export const localLevelKind = pgEnum('local_level_kind', [
  'metropolitan',      // महानगरपालिका (6)
  'sub_metropolitan',  // उपमहानगरपालिका (11)
  'municipality',      // नगरपालिका (276)
  'rural_municipality',// गाउँपालिका (460)
])

export const claimState = pgEnum('claim_state', [
  'unclaimed', 'pending', 'claimed', 'disputed',
])

export const orgStatus = pgEnum('org_status', [
  'active', 'temporarily_closed', 'permanently_closed', 'unverified_existence',
])

export const sourceKind = pgEnum('source_kind', [
  'official',      // government dataset, registry, gazette
  'field_visit',   // someone physically went there
  'phone_call',    // confirmed by calling
  'owner',         // the business itself, via claim
  'partner',       // FNCCI chapter, association, municipality
  'osm',           // OpenStreetMap (ODbL — keep derived geometry separable)
  'web',           // the business's own site or social page
  'inference',     // derived or model-generated — NEVER publishable alone
])

export const leadKind = pgEnum('lead_kind', [
  'view', 'phone_reveal', 'call_click', 'whatsapp_click',
  'directions_click', 'website_click', 'share', 'search_impression',
])

// ─────────────────────────────────────────── administrative spine
// Seeded once from official data. 7 → 77 → 753 → 6,743.

export const province = pgTable('province', {
  id: integer('id').primaryKey(),
  slug: varchar('slug', { length: 80 }).notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameNe: text('name_ne').notNull(),
  hqEn: text('hq_en'),
  hqNe: text('hq_ne'),
  areaSqKm: doublePrecision('area_sq_km'),
  website: text('website'),
})

export const district = pgTable('district', {
  id: integer('id').primaryKey(),
  provinceId: integer('province_id').notNull().references(() => province.id),
  slug: varchar('slug', { length: 80 }).notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameNe: text('name_ne').notNull(),
  hqEn: text('hq_en'),
  hqNe: text('hq_ne'),
  areaSqKm: doublePrecision('area_sq_km'),
  website: text('website'),
}, (t) => [index('district_province_idx').on(t.provinceId)])

export const localLevel = pgTable('local_level', {
  id: integer('id').primaryKey(),
  districtId: integer('district_id').notNull().references(() => district.id),
  slug: varchar('slug', { length: 100 }).notNull(),
  nameEn: text('name_en').notNull(),
  nameNe: text('name_ne').notNull(),
  kind: localLevelKind('kind').notNull(),
  wards: integer('wards').notNull().default(0),
  areaSqKm: doublePrecision('area_sq_km'),
  website: text('website'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  // Editorial: a hand-written paragraph makes the hub page worth indexing.
  introEn: text('intro_en'),
  introNe: text('intro_ne'),
}, (t) => [
  index('local_district_idx').on(t.districtId),
  // slug is unique per district, not nationally — several palikas share a name
  uniqueIndex('local_district_slug_idx').on(t.districtId, t.slug),
])

// ────────────────────────────────────────────────── taxonomy

export const category = pgTable('category', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 80 }).notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameNe: text('name_ne').notNull(),
  parentId: integer('parent_id'),
  // schema.org type emitted on entity pages: Restaurant, Hotel, School…
  schemaType: varchar('schema_type', { length: 60 }).notNull().default('LocalBusiness'),
  sort: integer('sort').notNull().default(0),
})

// ──────────────────────────────────────── organisation & location

export const organisation = pgTable('organisation', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 140 }).notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameNe: text('name_ne'),
  // Normalised, accent/script-folded name used for dedup and fuzzy search.
  nameKey: text('name_key').notNull(),
  categoryId: integer('category_id').references(() => category.id),
  descriptionEn: text('description_en'),
  descriptionNe: text('description_ne'),
  website: text('website'),
  facebook: text('facebook'),
  instagram: text('instagram'),
  email: text('email'),
  panVat: varchar('pan_vat', { length: 20 }),
  status: orgStatus('status').notNull().default('active'),
  claimStateValue: claimState('claim_state').notNull().default('unclaimed'),
  priceLevel: integer('price_level'), // 1–4, nullable

  // Computed, never hand-set. See lib/quality.ts
  qualityScore: integer('quality_score').notNull().default(0),
  published: boolean('published').notNull().default(false),

  // Freshness SLA. Verified records re-confirm within 180 days.
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verifiedBy: text('verified_by'),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('org_category_idx').on(t.categoryId),
  index('org_published_idx').on(t.published),
  index('org_namekey_idx').on(t.nameKey),
])

export const location = pgTable('location', {
  id: serial('id').primaryKey(),
  organisationId: integer('organisation_id').notNull()
    .references(() => organisation.id, { onDelete: 'cascade' }),
  localLevelId: integer('local_level_id').references(() => localLevel.id),
  ward: integer('ward'),
  label: text('label'),             // "Thamel branch" — null for single-site orgs
  isPrimary: boolean('is_primary').notNull().default(true),
  addressEn: text('address_en'),
  addressNe: text('address_ne'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  // Coarse geohash prefix for cheap proximity bucketing before PostGIS lands.
  geohash5: varchar('geohash5', { length: 5 }),
  phones: text('phones').array(),
  whatsapp: text('whatsapp'),
  // { mon: [["09:00","21:00"]], … , exceptions: [...] }
  hours: jsonb('hours'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('loc_org_idx').on(t.organisationId),
  index('loc_local_idx').on(t.localLevelId),
  index('loc_geohash_idx').on(t.geohash5),
])

// ──────────────────────────────────────────────────── provenance

export const source = pgTable('source', {
  id: serial('id').primaryKey(),
  kind: sourceKind('kind').notNull(),
  label: text('label').notNull(),      // "Visited 12 Aug 2026, spoke to owner"
  url: text('url'),
  capturedAt: timestamp('captured_at', { withTimezone: true }).notNull().defaultNow(),
})

/** One row per (entity, field). This table is the reason the data is worth money. */
export const fact = pgTable('fact', {
  id: serial('id').primaryKey(),
  entityType: varchar('entity_type', { length: 32 }).notNull(), // 'organisation' | 'location' | …
  entityId: integer('entity_id').notNull(),
  field: varchar('field', { length: 64 }).notNull(),
  sourceId: integer('source_id').references(() => source.id),
  confidence: integer('confidence').notNull().default(50), // 0–100
  verifiedBy: text('verified_by'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  note: text('note'),
}, (t) => [
  index('fact_entity_idx').on(t.entityType, t.entityId),
  uniqueIndex('fact_entity_field_idx').on(t.entityType, t.entityId, t.field),
])

export const media = pgTable('media', {
  id: serial('id').primaryKey(),
  entityType: varchar('entity_type', { length: 32 }).notNull(),
  entityId: integer('entity_id').notNull(),
  url: text('url').notNull(),
  width: integer('width'),
  height: integer('height'),
  caption: text('caption'),
  credit: text('credit'),
  // Photos taken on a field visit are evidence, not decoration.
  takenAt: timestamp('taken_at', { withTimezone: true }),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  sort: integer('sort').notNull().default(0),
}, (t) => [index('media_entity_idx').on(t.entityType, t.entityId)])

// ─────────────────────────────────────────── lead attribution
// Ships with v0, not year 5. The compounding loop only closes if a business
// can SEE the leads it received — that is what makes year two's invoice get paid.

export const leadEvent = pgTable('lead_event', {
  id: serial('id').primaryKey(),
  organisationId: integer('organisation_id').notNull()
    .references(() => organisation.id, { onDelete: 'cascade' }),
  kind: leadKind('kind').notNull(),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
  // Coarse only — no PII, no IP. Enough to prove value, not to track a person.
  referrer: text('referrer'),
  surface: varchar('surface', { length: 32 }), // 'place_hub' | 'search' | 'profile'
  sessionHash: varchar('session_hash', { length: 32 }),
}, (t) => [
  index('lead_org_at_idx').on(t.organisationId, t.at),
])

/** Zero-result searches are the highest-signal roadmap input we have. Log them. */
export const searchLog = pgTable('search_log', {
  id: serial('id').primaryKey(),
  q: text('q').notNull(),
  qKey: text('q_key').notNull(),
  results: integer('results').notNull(),
  localLevelId: integer('local_level_id'),
  at: timestamp('at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index('search_qkey_idx').on(t.qKey)])
