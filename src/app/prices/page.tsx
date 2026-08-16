import Link from 'next/link'
import type { Metadata } from 'next'
import { Container, EmptyState } from '@/components/ui'
import { allPrices, type ItemWithPrice } from '@/db/price-queries'
import { CONTEXT_LABEL, formatRange, daysSince, freshness, MIN_OBSERVATIONS } from '@/lib/prices'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'What things cost in Nepal — checked prices, with dates',
  description:
    'Real price ranges for taxis, SIMs, food and rooms in Nepal — each one observed, ' +
    'dated, and counted. We take no commission from anyone we price.',
  alternates: { canonical: '/prices' },
}

const CATEGORY: Record<string, string> = {
  transport: 'Getting around',
  essentials: 'The first hour',
  food: 'Eating and drinking',
  stay: 'Staying',
  doing: 'Guides and porters',
  other: 'Other',
}

export default async function PricesPage() {
  let items: ItemWithPrice[] = []
  try { items = await allPrices() } catch { /* build without a database */ }

  const grouped = items.reduce<Record<string, ItemWithPrice[]>>((acc, it) => {
    (acc[it.category] ??= []).push(it)
    return acc
  }, {})
  const publishedCount = items.filter((i) => i.summary?.published).length

  return (
    <Container className="py-10">
      <h1 className="text-[32px] sm:text-[38px] font-bold tracking-tight leading-[1.15] max-w-2xl">
        What things cost
      </h1>
      <p className="mt-4 text-[17px] text-[var(--color-ink-2)] max-w-2xl leading-relaxed">
        Real prices, observed and dated. Not what you should demand — what things
        actually cost, so you can tell a fair price from a bad one.
      </p>

      {/* The two-sided statement. This is the part a foreign guidebook cannot write,
          and the reason this page is worth trusting. */}
      <div className="mt-7 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 max-w-2xl">
        <h2 className="text-[16px] font-semibold tracking-tight mb-2">This page is fair in both directions</h2>
        <p className="text-[14px] text-[var(--color-ink-2)] leading-relaxed mb-2">
          It is here to protect you from being overcharged — and equally to protect the honest
          driver, who currently gets treated as a cheat because visitors have no way to tell him
          apart from one.
        </p>
        <p className="text-[14px] text-[var(--color-ink-2)] leading-relaxed mb-2">
          A higher price in Thamel or at the airport is usually <em>not</em> a scam. Frontage rent,
          late hours, a driver who returns empty, English spoken — those are real costs, and
          somebody pays them.
        </p>
        <p className="text-[14px] text-[var(--color-ink-2)] leading-relaxed mb-0">
          And the other way round: grinding a NPR&nbsp;50 item down to NPR&nbsp;30 is not a
          victory. It is twenty rupees, and it matters more to the person handing it over than to
          the person keeping it.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="mt-8">
          <EmptyState title="No prices loaded yet"
                      body="Run the price seed, then record observations at /prices/entry." />
        </div>
      ) : (
        <>
          <p className="text-[13.5px] text-[var(--color-ink-3)] mt-8 max-w-2xl">
            {publishedCount} of {items.length} checked enough times to publish. An entry needs at
            least <strong className="text-[var(--color-ink-2)]">{MIN_OBSERVATIONS} separate
            observations</strong> before it shows a range — one price is an anecdote, and this site
            does not publish anecdotes as facts.
          </p>

          {Object.entries(grouped).map(([cat, list]) => (
            <section key={cat} className="mt-10">
              <h2 className="text-[19px] font-semibold tracking-tight mb-3">
                {CATEGORY[cat] ?? cat}
              </h2>
              <ul className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]
                             divide-y divide-[var(--color-line)]">
                {list.map((it) => <Row key={it.slug} item={it} />)}
              </ul>
            </section>
          ))}
        </>
      )}

      <section className="mt-12 max-w-2xl">
        <h2 className="text-[18px] font-semibold tracking-tight mb-2">How to read these</h2>
        <ul className="text-[14.5px] text-[var(--color-ink-2)] leading-relaxed space-y-2 pl-5">
          <li>The figure is the <strong>median</strong> of what we saw, not the average — so one
            person being badly overcharged does not quietly become the going rate.</li>
          <li>The range is what ordinary prices span. Somebody will always find it cheaper, and
            somebody will always pay more.</li>
          <li>Every entry says when it was last checked. Prices in Nepal move, and a price with no
            date is a guess.</li>
          <li>Where we have enough observations, the airport and tourist-area figures are shown
            separately, because pretending one price exists everywhere helps nobody.</li>
          <li><strong>&ldquo;Set aside&rdquo;</strong> means an observation was far outside
            everything else — someone quoted five times the going rate, say. It is left out of the
            range but the count is shown, because quietly deleting awkward data is not something
            we will do. Where the split is genuinely even, nothing is set aside and the range stays
            wide, because then the wide range is the truth.</li>
        </ul>
      </section>

      <div className="mt-10 rounded-xl border border-[var(--color-line)] border-l-[3px]
                      border-l-[var(--color-crimson)] bg-[var(--color-surface)] p-5 max-w-2xl">
        <h3 className="text-[15px] font-semibold mb-1.5">We take no commission</h3>
        <p className="text-[13.5px] text-[var(--color-ink-2)] mb-0">
          Not from a driver, a hotel, a SIM shop or a trekking agency. A price guide funded by the
          businesses it prices is worth nothing, and everybody knows it — so we don&rsquo;t do
          that. <Link href="/promise" className="underline">Read the full promise</Link>.
        </p>
      </div>

      <p className="text-[13px] text-[var(--color-ink-3)] mt-8 max-w-2xl">
        Paid something very different?{' '}
        <a href="mailto:fix@simplenepal.com?subject=Price observation" className="underline">
          Tell us what and where
        </a>{' '}
        — a disagreement is another observation, and that is how the range gets honest.
      </p>
    </Container>
  )
}

function Row({ item }: { item: ItemWithPrice }) {
  const s = item.summary

  if (!s || !s.published) {
    return (
      <li className="px-4 py-3">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-[14.5px] font-medium">{item.nameEn}</span>
          {item.nameNe && <span className="ne text-[13px] text-[var(--color-ink-3)]">{item.nameNe}</span>}
          <span className="ml-auto text-[12.5px] text-[var(--color-ink-3)] shrink-0">
            {s ? `checked ${s.n}× — need ${MIN_OBSERVATIONS}` : 'not checked yet'}
          </span>
        </div>
      </li>
    )
  }

  const age = daysSince(s.lastCheckedAt)
  const fresh = freshness(age)

  return (
    <li className="px-4 py-3.5">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-[14.5px] font-medium">{item.nameEn}</span>
        {item.nameNe && <span className="ne text-[13px] text-[var(--color-ink-3)]">{item.nameNe}</span>}
        <span className="ml-auto text-[15.5px] font-semibold tabular-nums shrink-0">
          {formatRange(s.low, s.high)}
        </span>
      </div>

      <div className="flex items-baseline gap-x-3 gap-y-1 flex-wrap mt-1">
        <span className="text-[12.5px] text-[var(--color-ink-3)]">{item.unit}</span>
        <span className="text-[12.5px] text-[var(--color-ink-2)]">
          typically <strong className="tabular-nums">NPR {s.typical.toLocaleString()}</strong>
        </span>
        <span className={`text-[12px] ml-auto shrink-0 ${
          fresh === 'fresh' ? 'text-[var(--color-ink-3)]'
          : fresh === 'ageing' ? 'text-amber-700 dark:text-amber-500'
          : 'text-[var(--color-crimson)]'}`}>
          {s.n}×
          {s.excluded > 0 && ` (+${s.excluded} set aside)`}
          {' · '}
          {age === 0 ? 'checked today' : `checked ${age} day${age === 1 ? '' : 's'} ago`}
          {fresh === 'stale' && ' — may be out of date'}
        </span>
      </div>

      {s.byContext.length > 1 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
          {s.byContext.map((c) => (
            <span key={c.context} className="text-[12.5px] text-[var(--color-ink-2)]"
                  title={CONTEXT_LABEL[c.context].why}>
              {CONTEXT_LABEL[c.context].en}:{' '}
              <strong className="tabular-nums">NPR {c.typical.toLocaleString()}</strong>
              <span className="text-[var(--color-ink-3)]"> ({c.n})</span>
            </span>
          ))}
        </div>
      )}

      {item.noteEn && (
        <p className="text-[12.5px] text-[var(--color-ink-3)] mt-1.5 mb-0">{item.noteEn}</p>
      )}
    </li>
  )
}
