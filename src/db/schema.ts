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
  doublePrecision, jsonb, index, uniqueIndex, pgEnum, date, numeric,
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

// ═══════════════════════════════════════════════════════════════════════
// GOVERNANCE — agencies, their offices, and the services they deliver.
//
// Two hierarchies, joined many-to-many:
//   • the agency tree   — who exists (Ministry → Department → Office)
//   • the service       — what a citizen actually wants done
// A land transfer touches Malpot AND Napi AND a ward office. Modelling only
// the org chart builds a directory nobody searches; modelling only services
// can't answer "which office serves me". The value is in the join.
// ═══════════════════════════════════════════════════════════════════════

export const agencyLevel = pgEnum('agency_level', [
  'federal', 'province', 'district', 'local',
])

export const agencyKind = pgEnum('agency_kind', [
  'ministry', 'department', 'authority', 'office', 'commission', 'ward_office',
])

/**
 * Agencies are never deleted, only superseded. Nepal cut federal ministries
 * from 21 to 18 in May 2026; most references online silently overwrote the old
 * names and broke their links. Keeping the old record with a pointer to its
 * successor means old URLs still work, a confused citizen gets an explanation,
 * and we accumulate an institutional history nobody can retrofit.
 */
export const agencyStatus = pgEnum('agency_status', [
  'active', 'merged', 'abolished', 'renamed',
])

export const agency = pgTable('agency', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 140 }).notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameNe: text('name_ne'),
  abbrEn: varchar('abbr_en', { length: 24 }),
  level: agencyLevel('level').notNull(),
  kind: agencyKind('kind').notNull(),
  parentId: integer('parent_id'),

  // Where it sits in the country. All nullable — a federal ministry sits nowhere.
  provinceId: integer('province_id').references(() => province.id),
  districtId: integer('district_id').references(() => district.id),
  localLevelId: integer('local_level_id').references(() => localLevel.id),

  website: text('website'),
  phone: text('phone'),
  email: text('email'),
  descriptionEn: text('description_en'),
  descriptionNe: text('description_ne'),

  status: agencyStatus('status').notNull().default('active'),
  succeededById: integer('succeeded_by_id'),
  successionNote: text('succession_note'),
  establishedOn: timestamp('established_on', { withTimezone: true }),
  abolishedOn: timestamp('abolished_on', { withTimezone: true }),

  qualityScore: integer('quality_score').notNull().default(0),
  published: boolean('published').notNull().default(false),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verifiedBy: text('verified_by'),
  sort: integer('sort').notNull().default(0),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('agency_parent_idx').on(t.parentId),
  index('agency_level_kind_idx').on(t.level, t.kind),
  index('agency_published_idx').on(t.published),
])

/** A physical counter. One agency can have many (77 district offices, say). */
export const agencyOffice = pgTable('agency_office', {
  id: serial('id').primaryKey(),
  agencyId: integer('agency_id').notNull()
    .references(() => agency.id, { onDelete: 'cascade' }),
  labelEn: text('label_en'),
  labelNe: text('label_ne'),
  localLevelId: integer('local_level_id').references(() => localLevel.id),
  districtId: integer('district_id').references(() => district.id),
  ward: integer('ward'),
  addressEn: text('address_en'),
  addressNe: text('address_ne'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  geohash5: varchar('geohash5', { length: 5 }),
  phones: text('phones').array(),
  email: text('email'),
  hours: jsonb('hours'),
  isPrimary: boolean('is_primary').notNull().default(true),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verifiedBy: text('verified_by'),
}, (t) => [
  index('agency_office_agency_idx').on(t.agencyId),
  index('agency_office_local_idx').on(t.localLevelId),
  index('agency_office_district_idx').on(t.districtId),
])

/**
 * WHICH PLACES an office serves — deliberately separate from where it IS.
 *
 * A citizen does not want the nearest Land Revenue Office, they want the one
 * with authority over their land, which is decided by ward, not distance.
 * Sending someone to the wrong office costs them a day and their trust in us.
 */
export const agencyJurisdiction = pgTable('agency_jurisdiction', {
  id: serial('id').primaryKey(),
  agencyOfficeId: integer('agency_office_id').notNull()
    .references(() => agencyOffice.id, { onDelete: 'cascade' }),
  coversType: varchar('covers_type', { length: 16 }).notNull(), // 'district' | 'local_level' | 'ward'
  coversId: integer('covers_id').notNull(),
  ward: integer('ward'),
  note: text('note'),
}, (t) => [
  index('jurisdiction_covers_idx').on(t.coversType, t.coversId),
  index('jurisdiction_office_idx').on(t.agencyOfficeId),
])

// ──────────────────────────────────────────────────────── services

export const serviceCategory = pgEnum('service_category', [
  'identity',          // citizenship, passport, national ID
  'civil_registration',// birth, death, marriage, migration
  'land',              // ownership, transfer, maps, revenue
  'vehicle',           // licence, registration, transfer
  'business',          // PAN, VAT, company registration
  'education', 'health', 'social_security', 'other',
])

export const serviceAgencyRole = pgEnum('service_agency_role', [
  'primary',        // where the service is actually delivered
  'recommendation', // e.g. ward office issues the सिफारिस first
  'verification',
  'payment',
  'appeal',
])

export const service = pgTable('service', {
  id: serial('id').primaryKey(),
  slug: varchar('slug', { length: 140 }).notNull().unique(),
  nameEn: text('name_en').notNull(),
  nameNe: text('name_ne'),
  category: serviceCategory('category').notNull(),
  summaryEn: text('summary_en'),
  summaryNe: text('summary_ne'),
  eligibilityEn: text('eligibility_en'),
  eligibilityNe: text('eligibility_ne'),

  /**
   * A fee CANNOT be published without a source. This is a foreign key rather
   * than a note precisely so the schema refuses to hold an untraceable number —
   * getting a fee wrong costs a citizen money and costs us their trust.
   */
  feeAmount: integer('fee_amount'),
  feeNote: text('fee_note'),
  feeSourceId: integer('fee_source_id').references(() => source.id),

  durationTypical: text('duration_typical'),
  legalBasis: text('legal_basis'),
  onlineUrl: text('online_url'),

  qualityScore: integer('quality_score').notNull().default(0),
  published: boolean('published').notNull().default(false),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  verifiedBy: text('verified_by'),
  sort: integer('sort').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('service_category_idx').on(t.category),
  index('service_published_idx').on(t.published),
])

export const serviceStep = pgTable('service_step', {
  id: serial('id').primaryKey(),
  serviceId: integer('service_id').notNull()
    .references(() => service.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  titleEn: text('title_en').notNull(),
  titleNe: text('title_ne'),
  detailEn: text('detail_en'),
  detailNe: text('detail_ne'),
  // Nullable on purpose — some steps are "go home and wait".
  atAgencyId: integer('at_agency_id').references(() => agency.id),
}, (t) => [index('service_step_service_idx').on(t.serviceId, t.position)])

export const serviceDocument = pgTable('service_document', {
  id: serial('id').primaryKey(),
  serviceId: integer('service_id').notNull()
    .references(() => service.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  nameEn: text('name_en').notNull(),
  nameNe: text('name_ne'),
  note: text('note'),
  required: boolean('required').notNull().default(true),
  copies: integer('copies').notNull().default(1),
}, (t) => [index('service_doc_service_idx').on(t.serviceId)])

export const serviceAgency = pgTable('service_agency', {
  id: serial('id').primaryKey(),
  serviceId: integer('service_id').notNull()
    .references(() => service.id, { onDelete: 'cascade' }),
  agencyId: integer('agency_id').notNull()
    .references(() => agency.id, { onDelete: 'cascade' }),
  role: serviceAgencyRole('role').notNull().default('primary'),
}, (t) => [
  uniqueIndex('service_agency_uniq').on(t.serviceId, t.agencyId, t.role),
])

// ───────────────────────────────────── citizen service reports
// Deliberately NOT "reviews". Star ratings on a government office produce a
// number nobody can act on and everybody can argue with, and they invite people
// to name individual officials. Structured questions produce statistics that
// have never existed in Nepal — about a process, not a person.

export const reportOutcome = pgEnum('report_outcome', ['done', 'not_done', 'returning'])
export const waitBand = pgEnum('wait_band', ['under_30m', '30_60m', '1_2h', 'half_day', 'more'])
export const reportStatus = pgEnum('report_status', ['pending', 'published', 'rejected'])

export const citizen = pgTable('citizen', {
  id: serial('id').primaryKey(),
  // Hashed — after verification we have no reason to keep the number itself.
  phoneHash: varchar('phone_hash', { length: 64 }).unique(),
  displayName: text('display_name'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  reputation: integer('reputation').notNull().default(0),
  blocked: boolean('blocked').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const serviceReport = pgTable('service_report', {
  id: serial('id').primaryKey(),
  serviceId: integer('service_id').notNull().references(() => service.id),
  agencyOfficeId: integer('agency_office_id').references(() => agencyOffice.id),
  citizenId: integer('citizen_id').references(() => citizen.id),

  outcome: reportOutcome('outcome').notNull(),
  visitCount: integer('visit_count'),
  wait: waitBand('wait'),
  documentsMatched: boolean('documents_matched'),
  documentsNote: text('documents_note'),   // every "no" is a correction to our own page
  treatmentRating: integer('treatment_rating'), // 1–5
  suggestion: varchar('suggestion', { length: 200 }),

  /**
   * Collected but NOT published per-office. Aggregated informal-payment data has
   * never existed in Nepal and would be genuinely important — but publishing it
   * turns a map of the state into a corruption-reporting platform, with real
   * personal exposure under the Electronic Transactions Act. Hold until there is
   * written legal advice. See the governance plan, §11.
   */
  informalPayment: boolean('informal_payment'),

  occurredOn: timestamp('occurred_on', { withTimezone: true }),
  status: reportStatus('status').notNull().default('pending'),
  moderatedBy: text('moderated_by'),
  moderatedAt: timestamp('moderated_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('report_service_idx').on(t.serviceId),
  index('report_office_idx').on(t.agencyOfficeId),
  index('report_status_idx').on(t.status),
])

// ─────────────────────────────────────── when offices are actually open
//
// The single most useful thing we can tell someone about a government office
// is whether it is worth travelling there today. In Nepal that is not a static
// fact: the Cabinet moved offices to a Saturday–Sunday weekend and 9–5 hours in
// April 2026, tied to fuel supply and explicitly "subject to periodic review".
//
// So the weekly pattern is DATA, with a source and an effective date range —
// not a constant in the code. When it reverts, we insert a row and the whole
// site changes; nobody has to find a hardcoded array.

export const scheduleScope = pgEnum('schedule_scope', ['national', 'province', 'district', 'local', 'office'])

export const officeSchedule = pgTable('office_schedule', {
  id: serial('id').primaryKey(),
  scope: scheduleScope('scope').notNull().default('national'),
  scopeId: integer('scope_id'),                       // null for national
  labelEn: text('label_en').notNull(),
  labelNe: text('label_ne'),
  /** Days the office is open. 0 = Sunday … 6 = Saturday. */
  openDays: integer('open_days').array().notNull(),
  openTime: varchar('open_time', { length: 5 }).notNull(),   // 'HH:MM', Nepal time
  closeTime: varchar('close_time', { length: 5 }).notNull(),
  /** Fridays and winter months are often shorter. Null means same as above. */
  shortDay: integer('short_day'),
  shortCloseTime: varchar('short_close_time', { length: 5 }),
  effectiveFrom: date('effective_from').notNull(),
  effectiveTo: date('effective_to'),                  // null = still in force
  sourceId: integer('source_id').references(() => source.id),
  note: text('note'),
  published: boolean('published').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('office_schedule_scope_idx').on(t.scope, t.scopeId, t.effectiveFrom),
])

/**
 * Public holidays close offices, and Nepal has many — national, province-level,
 * and community observances that close some offices and not others.
 *
 * `published` works exactly as it does for agencies: false means we have it from
 * a source we haven't confirmed, so it may inform a warning but must never
 * produce a confident "closed". An unconfirmed holiday is still worth showing —
 * "possibly closed, check first" beats silence when the alternative is a wasted
 * six-hour bus ride.
 */
export const holiday = pgTable('holiday', {
  id: serial('id').primaryKey(),
  nameEn: text('name_en').notNull(),
  nameNe: text('name_ne'),
  /** The Gregorian date. BS fields are denormalised for display and search. */
  date: date('date').notNull(),
  bsYear: integer('bs_year'),
  bsMonth: integer('bs_month'),
  bsDay: integer('bs_day'),
  scope: scheduleScope('scope').notNull().default('national'),
  scopeId: integer('scope_id'),
  /** Some holidays apply to a community rather than a place — record honestly. */
  appliesToNote: text('applies_to_note'),
  isFullDay: boolean('is_full_day').notNull().default(true),
  sourceId: integer('source_id').references(() => source.id),
  confidence: integer('confidence').notNull().default(50),
  published: boolean('published').notNull().default(false),
  note: text('note'),
}, (t) => [
  index('holiday_date_idx').on(t.date),
  uniqueIndex('holiday_unique_idx').on(t.date, t.nameEn, t.scope, t.scopeId),
])

// ────────────────────────────────────────────────── rates: money and metal
//
// Two very different sourcing stories, so two different tables and two very
// different confidence levels.
//
// Currency comes from Nepal Rastra Bank's official API — the central bank's own
// published reference rate, fetched daily and stored with the date it applies
// to. Metal rates have no public feed anywhere, so they are entered by hand,
// weekly, and we publish only TRENDS from them. We do not republish anyone's
// daily commercial rate; we link to the publisher for that.

export const fxRate = pgTable('fx_rate', {
  id: serial('id').primaryKey(),
  /** The date the rate applies to, not the date we fetched it. */
  date: date('date').notNull(),
  iso3: varchar('iso3', { length: 3 }).notNull(),
  currencyName: text('currency_name').notNull(),
  /** NRB quotes some currencies per 100 units (JPY, KRW). Never assume 1. */
  unit: integer('unit').notNull().default(1),
  /** numeric, not float: money must not accumulate binary rounding error. */
  buy: numeric('buy', { precision: 14, scale: 4 }).notNull(),
  sell: numeric('sell', { precision: 14, scale: 4 }).notNull(),
  sourceId: integer('source_id').references(() => source.id),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('fx_rate_date_iso_idx').on(t.date, t.iso3),
  index('fx_rate_iso_date_idx').on(t.iso3, t.date),
])

export const metalKind = pgEnum('metal_kind', ['gold_hallmark', 'gold_tejabi', 'silver'])

/**
 * A weekly observation, entered by hand from the published rate.
 *
 * Deliberately weekly, not daily. Fifty-two points a year is ample for monthly
 * and annual trend charts, which is all we publish — and collecting a trend is
 * a different act from mirroring somebody's live commercial feed.
 */
export const metalRate = pgTable('metal_rate', {
  id: serial('id').primaryKey(),
  date: date('date').notNull(),
  metal: metalKind('metal').notNull(),
  /** Nepali rupees per tola (11.6638 g). Whole rupees — the published unit. */
  perTola: integer('per_tola').notNull(),
  sourceId: integer('source_id').references(() => source.id),
  enteredBy: text('entered_by'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('metal_rate_date_metal_idx').on(t.date, t.metal),
  index('metal_rate_metal_date_idx').on(t.metal, t.date),
])
