import Link from 'next/link'
import type { Metadata } from 'next'
import { Container } from '@/components/ui'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Our promise — what we take money for, and what we refuse',
  description:
    'SimpleNepal takes no commission from any business it lists, prices or recommends. ' +
    'What we will and will not do, stated publicly so it can be held against us.',
  alternates: { canonical: '/promise' },
}

export default function PromisePage() {
  return (
    <Container className="py-10">
      <h1 className="text-[32px] sm:text-[38px] font-bold tracking-tight leading-[1.15] max-w-2xl">
        Our promise
      </h1>
      <p className="mt-4 text-[17px] text-[var(--color-ink-2)] max-w-2xl leading-relaxed">
        This page exists so you can hold us to something. If we ever break one of these, it will
        be in writing, here, with the date we changed it.
      </p>

      <section className="mt-10 max-w-2xl">
        <h2 className="text-[20px] font-semibold tracking-tight mb-3">What we will never do</h2>
        <ul className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]
                       divide-y divide-[var(--color-line)]">
          {[
            ['Take commission from anyone we recommend',
             'Not from a driver, a hotel, a SIM shop, a restaurant or a trekking agency. A price guide funded by the businesses it prices is worth nothing to you, and everybody knows it.'],
            ['Sell a higher ranking',
             'A business can pay to be verified and listed. It can never pay to appear above another, or to be recommended. Money changes whether you are on the list, never where.'],
            ['Publish a fact we cannot source',
             'Every figure on this site says where it came from and when it was checked. Where we are not sure, the page says so instead of sounding confident.'],
            ['Quietly delete a mistake',
             'When something here is wrong we correct it and say what changed. A record that silently rewrites itself cannot be trusted about anything.'],
            ['Sell your personal data',
             'We do not build a profile of you, and there is nothing here to sell.'],
          ].map(([h, b]) => (
            <li key={h} className="px-4 py-3.5">
              <div className="text-[15px] font-medium">{h}</div>
              <p className="text-[13.5px] text-[var(--color-ink-2)] mt-1 mb-0 leading-relaxed">{b}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 max-w-2xl">
        <h2 className="text-[20px] font-semibold tracking-tight mb-3">How we intend to make money</h2>
        <p className="text-[14.5px] text-[var(--color-ink-2)] leading-relaxed mb-3">
          Stated plainly, because a site that will not say how it earns is usually earning in a way
          you would not like.
        </p>
        <ul className="text-[14.5px] text-[var(--color-ink-2)] leading-relaxed space-y-2 pl-5">
          <li>
            <strong className="text-[var(--color-ink)]">Businesses pay a flat fee to be verified
            and listed.</strong> Someone visits, checks, photographs and records who checked it.
            That work costs money. The fee buys the visit — never the ranking, and never a
            recommendation.
          </li>
          <li>
            <strong className="text-[var(--color-ink)]">Travellers may one day pay us directly</strong>{' '}
            for help that takes a person&rsquo;s time. If that happens, it will be priced openly
            and it will not change a single thing on the free pages.
          </li>
          <li>
            <strong className="text-[var(--color-ink)]">Organisations may licence the data.</strong>{' '}
            The archive is only worth licensing because it is uncorrupted, which is the whole
            reason the rules above are not negotiable.
          </li>
        </ul>
      </section>

      <section className="mt-12 max-w-2xl">
        <h2 className="text-[20px] font-semibold tracking-tight mb-3">Why this is not charity</h2>
        <p className="text-[14.5px] text-[var(--color-ink-2)] leading-relaxed mb-3">
          Refusing commission is not a sacrifice we are making to feel good. It is the only way the
          thing we are building is worth anything.
        </p>
        <p className="text-[14.5px] text-[var(--color-ink-2)] leading-relaxed mb-0">
          A verified record is valuable precisely because nobody paid for the verdict. The moment
          a fee could change what we say, everything we have said becomes worthless — including all
          of it that was honest. There is no version of this business that survives selling that.
        </p>
      </section>

      <section className="mt-12 max-w-2xl">
        <h2 className="text-[20px] font-semibold tracking-tight mb-3">Fair in both directions</h2>
        <p className="text-[14.5px] text-[var(--color-ink-2)] leading-relaxed mb-3">
          Most guides written for visitors treat Nepalis as a hazard to be managed. We are Nepali,
          and we will not do that.
        </p>
        <p className="text-[14.5px] text-[var(--color-ink-2)] leading-relaxed mb-0">
          Publishing real prices protects you from being overcharged — and it protects the honest
          driver, who is currently treated as a cheat because you have no way to tell him apart
          from one. Both of those matter to us, and where they conflict we will say so rather than
          quietly pick a side.{' '}
          <Link href="/prices" className="underline">See what things cost</Link>.
        </p>
      </section>

      <div className="mt-12 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 max-w-2xl">
        <h3 className="text-[15px] font-semibold mb-1.5">Hold us to it</h3>
        <p className="text-[13.5px] text-[var(--color-ink-2)] mb-0">
          If you think we have broken one of these,{' '}
          <a href="mailto:fix@simplenepal.com?subject=You broke your promise" className="underline">
            write and say so
          </a>
          . We would rather be told than found out.
        </p>
      </div>
    </Container>
  )
}
