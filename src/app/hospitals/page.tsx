import Link from 'next/link'
import type { Metadata } from 'next'
import { Container, EmptyState } from '@/components/ui'
import { ListingBadge, ListingExplainer } from '@/components/listing-badge'
import { facilities, type FacilityEntry } from '@/db/directory'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Hospitals and health facilities in Nepal',
  description:
    'Hospitals, health posts and clinics in Nepal from the government health facility ' +
    'registry — what kind, who runs it, and whether it takes emergencies.',
  alternates: { canonical: '/hospitals' },
}

const KIND: Record<string, string> = {
  teaching_hospital: 'Teaching hospital',
  hospital: 'Hospital',
  primary_health_centre: 'Primary health centre',
  health_post: 'Health post',
  clinic: 'Clinic',
}

const OWNERSHIP: Record<string, string> = {
  government: 'Government', community: 'Community', private: 'Private',
  ngo: 'NGO', teaching: 'Teaching',
}

export default async function HospitalsPage() {
  let rows: FacilityEntry[] = []
  try { rows = await facilities() } catch { /* build without a database */ }

  const byDistrict = rows.reduce<Record<string, FacilityEntry[]>>((acc, f) => {
    (acc[f.districtName ?? 'District not recorded'] ??= []).push(f)
    return acc
  }, {})

  return (
    <Container className="py-10">
      <h1 className="text-[32px] sm:text-[38px] font-bold tracking-tight leading-[1.15] max-w-2xl">
        Hospitals and health facilities
      </h1>
      <p className="mt-4 text-[17px] text-[var(--color-ink-2)] max-w-2xl leading-relaxed">
        What kind of facility it is, who runs it, and whether it takes emergencies.
      </p>

      {/* This page can be read in the worst ten minutes of somebody's year. */}
      <div className="mt-7 rounded-xl border border-[var(--color-line)] border-l-[3px]
                      border-l-[var(--color-crimson)] bg-[var(--color-crimson-soft)]
                      p-5 max-w-2xl">
        <p className="text-[14.5px] text-[var(--color-ink)] mb-0">
          <strong>In an emergency right now, do not read a list.</strong> Call{' '}
          <a href="tel:102" className="underline font-semibold">102</a> for an ambulance or{' '}
          <a href="tel:100" className="underline font-semibold">100</a> for police, and go to the
          nearest hospital. <Link href="/emergency" className="underline">All emergency numbers</Link>.
        </p>
      </div>

      <ListingExplainer registry="NHFR" what="facilities" />

      {rows.length === 0 ? (
        <div className="mt-8 max-w-2xl">
          <EmptyState
            title="Not loaded yet"
            body="The government publishes a health facility registry. Import it as a worklist and it appears here as listings — then it improves one visit at a time."
          />
          <p className="text-[13.5px] text-[var(--color-ink-2)] mt-4 leading-relaxed">
            The source is the Ministry of Health and Population&rsquo;s{' '}
            <a href="https://nhfr.mohp.gov.np/" rel="nofollow noopener" className="underline">
              Nepal Health Facility Registry
            </a>
            . We have not invented a single entry to make this page look fuller, which is why it
            is empty — an invented hospital is worse than no hospital.
          </p>
        </div>
      ) : (
        <>
          <p className="text-[13.5px] text-[var(--color-ink-3)] mt-8 max-w-2xl">
            {rows.length} listed ·{' '}
            <strong className="text-[var(--color-ink-2)]">
              {rows.filter((r) => r.verified).length} visited by us
            </strong>
          </p>

          {Object.entries(byDistrict).map(([dist, list]) => (
            <section key={dist} className="mt-9">
              <h2 className="text-[18px] font-semibold tracking-tight mb-3">{dist}</h2>
              <ul className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]
                             divide-y divide-[var(--color-line)]">
                {list.map((f) => (
                  <li key={f.slug} className="px-4 py-3">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[14.5px] font-medium">{f.nameEn}</span>
                      <span className="text-[12.5px] text-[var(--color-ink-3)]">
                        {KIND[f.kind] ?? f.kind} · {OWNERSHIP[f.ownership] ?? f.ownership}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 flex-wrap mt-1">
                      {f.beds && (
                        <span className="text-[12.5px] text-[var(--color-ink-2)]">{f.beds} beds</span>
                      )}
                      {/* Unknown is shown as unknown. On this page especially,
                          silence would be read as "no". */}
                      <span className="text-[12.5px] text-[var(--color-ink-2)]">
                        {f.hasEmergency === true ? 'Takes emergencies'
                          : f.hasEmergency === false ? 'No emergency department'
                          : 'Emergency cover not recorded'}
                      </span>
                      <span className="ml-auto shrink-0">
                        <ListingBadge verified={f.verified} verifiedBy={f.verifiedBy}
                                      registryName={f.registryName} />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </Container>
  )
}
