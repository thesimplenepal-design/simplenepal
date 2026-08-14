# SimpleNepal

A verified, structured database of Nepal — with a website on top.

The premise: **we publish nothing we have not checked.** Every live record names a
human verifier and a verification date, and pages that do not clear the quality
gate stay out of the index rather than padding the site.

**Current state (v0.1):** the full administrative spine is seeded and browsable —
7 provinces, 77 districts, 753 local levels, 6,743 wards, bilingual. Zero business
records, because none have been verified yet. That is correct, not incomplete.

---

## Run it locally

```bash
cp .env.example .env          # then edit DATABASE_URL
npm install
npm run db:push               # create tables
npm run seed:admin            # 7 / 77 / 753 / 6,743 — takes ~5 seconds
npm run seed:categories       # food & lodging, the first deep category
npm run dev
```

Open http://localhost:3000. The field tool is at `/capture` (password = `ADMIN_PASSWORD`).

If you don't have Postgres locally:

```bash
docker run -d --name sn-pg -e POSTGRES_PASSWORD=pg -p 5432:5432 postgres:16
# DATABASE_URL=postgres://postgres:pg@localhost:5432/postgres
```

---

## Deploy: Vercel + Neon + Squarespace DNS

**1. Database (Neon, free tier).** Create a project at neon.tech, copy the pooled
connection string. It already ends in `?sslmode=require` — keep that.

**2. Vercel.** Import the GitHub repo. Set three environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | your Neon pooled connection string |
| `ADMIN_PASSWORD` | something long and random — this is the only thing protecting `/capture` |
| `NEXT_PUBLIC_SITE_URL` | `https://simplenepal.com` |

Then run the migrations and seeds once against Neon, from your machine:

```bash
DATABASE_URL="<neon-url>" npm run db:push
DATABASE_URL="<neon-url>" npm run seed:admin
DATABASE_URL="<neon-url>" npm run seed:categories
```

**3. Domain (Squarespace registrar).** In Vercel → Project → Settings → Domains,
add `simplenepal.com` and `www.simplenepal.com`. Then in Squarespace → Domains →
simplenepal.com → DNS Settings, add:

| Type | Host | Value |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

Vercel shows the exact values it wants on the Domains screen — use those if they
differ from the above, they change occasionally. Propagation is usually minutes.

**Himalayan Hosting** is shared cPanel and cannot run Next.js. Keep it for
`@simplenepal.com` email if you like — just don't point the apex A record at it,
or the site will resolve to the wrong place. If you do use it for email, add its
MX records in Squarespace alongside the A/CNAME above.

---

## What is here

```
src/db/schema.ts        The Nepal Graph. Read this first.
src/db/seed-admin.ts    Provinces → districts → local levels, from official data
src/lib/np.ts           Devanagari transliteration, name keys, slugs, geohash
src/lib/quality.ts      The publish gate — `published` is computed, never set by hand
src/app/nepal/…         Place hubs: province → district → local level
src/app/biz/[slug]      Business profile, incl. the "How we know this" receipt
src/app/capture/        The mobile field tool (this is the one that matters)
src/app/api/capture     Capture → dedup → provenance → score → publish-or-draft
src/app/api/lead        Lead attribution. Ships in v0, not year 5.
```

### Three decisions worth understanding before changing anything

**1. `organisation` and `location` are separate tables.** A business is an identity;
a location is a physical presence. Chains break any model that conflates them, and
multi-location is a paid tier later. This costs ~20 lines now and saves a brutal
migration in year three.

**2. `fact` is a table, not a comment.** One row per (entity, field), each naming its
source, verifier and date. This is what makes the data licensable and the Verified
badge honest — and it is what the "How we know this" section on every profile renders.

**3. Nothing publishes below the gate.** `scoreOrganisation()` requires a photo, a map
pin, a local level and a fresh in-person verification before `published` flips true.
Thin auto-generated pages are how programmatic directories get demoted by Google and
never recover. Do not add a manual override. You will want one; don't.

---

## Deliberately not built yet

Each of these is a real decision, not an oversight:

- **No Typesense.** Postgres `ILIKE` + normalised name keys is indistinguishable in
  quality at a few hundred records and costs nothing to operate. Swap at ~50k records.
- **No R2 / object storage.** Photos write to `public/u`. Swap the two lines in
  `savePhoto()` when there are enough to matter. **Note:** Vercel's filesystem is
  ephemeral, so photo uploads must move to R2 *before* capture is used in production —
  this is the one item on this list with a deadline.
- **No PostGIS.** A 5-char geohash column covers proximity bucketing until "near me"
  becomes a real feature.
- **No auth system.** One operator, one password. Phone-OTP arrives with claims.
- **No app.** Nobody installs an app for a site they visit twice.
- **No reviews.** Launching reviews before there is anything to review, and before a
  published moderation policy exists, is how a directory loses its credibility once
  and permanently.

## Data sources

- Administrative spine: [local-states-nepal](https://github.com/sagautam5/local-states-nepal) (MIT)
- Everything else: field verification, one place at a time.
