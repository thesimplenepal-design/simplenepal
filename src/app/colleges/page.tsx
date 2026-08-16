import Link from 'next/link'
import type { Metadata } from 'next'
import { Container, EmptyState } from '@/components/ui'
import { ListingBadge, ListingExplainer } from '@/components/listing-badge'
import { colleges, type DirectoryEntry } from '@/db/directory'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Universities and colleges in Nepal — who is affiliated to whom',
  description:
    'Nepal’s universities and the colleges affiliated to them, from the UGC register. ' +
    'Nobody paid to be on this list and nobody can pay to be higher on it.',
  alternates: { canonical: '/colleges' },
}

export default async function CollegesPage() {
  let data: Awaited<ReturnType<typeof colleges>> | null = null
  try { data = await colleges() } catch { /* build without a database */ }

  const universities = data?.universities ?? []
  const rest = data?.colleges ?? []
  const counts = data?.counts ?? { total: 0, verified: 0, universities: 0 }

  const byUniversity = rest.reduce<Record<string, DirectoryEntry[]>>((acc, c) => {
    const key = c.detail?.startsWith('Affiliated to ')
      ? c.detail.slice('Affiliated to '.length).split(' · ')[0]
      : 'Affiliation not recorded'
    ;(acc[key] ??= []).push(c)
    return acc
  }, {})

  return (
    <Container className="py-10">
      <h1 className="text-[32px] sm:text-[38px] font-bold tracking-tight leading-[1.15] max-w-2xl">
        Universities and colleges
      </h1>
      <p className="mt-4 text-[17px] text-[var(--color-ink-2)] max-w-2xl leading-relaxed">
        Which universities exist in Nepal, and which colleges are affiliated to them.
        Nobody paid to be on this list, and nobody can pay to be higher on it.
      </p>

      {/* The reason to build this at all. Say it plainly. */}
      <div className="mt-7 rounded-xl border border-[var(--color-line)] border-l-[3px]
                      border-l-[var(--color-crimson)] bg-[var(--color-surface)] p-5 max-w-2xl">
        <h2 className="text-[16px] font-semibold tracking-tight mb-2">
          Why we started this list
        </h2>
        <p className="text-[14px] text-[var(--color-ink-2)] leading-relaxed mb-2">
          Search for colleges in Nepal and almost everything you find is advertising — the
          colleges paying most appear first, and &ldquo;top ten&rdquo; means whoever bought the
          slot. A student choosing where to spend four years and their family&rsquo;s money
          deserves better than a rate card.
        </p>
        <p className="text-[14px] text-[var(--color-ink-2)] leading-relaxed mb-0">
          So the one thing we lead with is <strong>affiliation</strong> — who actually awards
          the degree. It is the fact that matters most and the one an advertisement is least
          motivated to state plainly. <Link href="/promise" className="underline">Our promise</Link>.
        </p>
      </div>

      <ListingExplainer registry="UGC" what="institutions" />

      {counts.total === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Nothing loaded yet"
            body="Run the university seed, then bring the affiliated colleges in from the UGC register with the CSV importer."
          />
        </div>
      ) : (
        <>
          <p className="text-[13.5px] text-[var(--color-ink-3)] mt-8 max-w-2xl">
            {counts.universities} universities · {rest.length} colleges listed ·{' '}
            <strong className="text-[var(--color-ink-2)]">{counts.verified} visited by us</strong>.
            That last number is the honest one, and it will grow slowly.
          </p>

          <section className="mt-10">
            <h2 className="text-[20px] font-semibold tracking-tight mb-1">
              Universities and degree-awarding bodies
            </h2>
            <p className="text-[13px] text-[var(--color-ink-3)] mb-4">
              Recognised by the University Grants Commission. These are the bodies that actually
              award degrees; a college teaches towards one of them.
            </p>
            <ul className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]
                           divide-y divide-[var(--color-line)]">
              {universities.map((u) => <Row key={u.slug} e={u} />)}
            </ul>
          </section>

          {Object.entries(byUniversity).map(([uni, list]) => (
            <section key={uni} className="mt-10">
              <h2 className="text-[18px] font-semibold tracking-tight mb-1">{uni}</h2>
              <p className="text-[13px] text-[var(--color-ink-3)] mb-3">
                {list.length} college{list.length === 1 ? '' : 's'} listed
              </p>
              <ul className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]
                             divide-y divide-[var(--color-line)]">
                {list.map((c) => <Row key={c.slug} e={c} />)}
              </ul>
            </section>
          ))}
        </>
      )}

      <div className="mt-12 max-w-2xl rounded-xl border border-[var(--color-line)]
                      bg-[var(--color-surface)] p-5">
        <h3 className="text-[15px] font-semibold mb-1.5">Something wrong here?</h3>
        <p className="text-[13.5px] text-[var(--color-ink-2)] mb-0">
          If an affiliation has changed, a college has closed, or we have a name wrong,{' '}
          <a href="mailto:fix@simplenepal.com?subject=Colleges" className="underline">tell us</a>.
          Corrections are free and always will be — that is rather the point.
        </p>
      </div>
    </Container>
  )
}

function Row({ e }: { e: DirectoryEntry }) {
  const inner = (
    <>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[14.5px] font-medium">{e.nameEn}</span>
        {e.nameNe && <span className="ne text-[13px] text-[var(--color-ink-3)]">{e.nameNe}</span>}
        {e.districtName && (
          <span className="text-[12.5px] text-[var(--color-ink-3)]">{e.districtName}</span>
        )}
      </div>
      <div className="flex items-baseline gap-2 flex-wrap mt-1">
        {e.detail && <span className="text-[12.5px] text-[var(--color-ink-2)]">{e.detail}</span>}
        <span className="ml-auto shrink-0">
          <ListingBadge verified={e.verified} verifiedBy={e.verifiedBy} registryName={e.registryName} />
        </span>
      </div>
    </>
  )

  // Only a visited, published record earns its own page. A listing with nothing
  // but a name would be a thin page, and a site full of them gets demoted —
  // deservedly, because it would deserve to be.
  return (
    <li className="px-4 py-3">
      {e.published ? (
        <Link href={`/biz/${e.slug}`} className="block no-underline">{inner}</Link>
      ) : inner}
    </li>
  )
}
