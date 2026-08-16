import Link from 'next/link'
import type { Metadata } from 'next'
import { Container } from '@/components/ui'
import { AddressCard } from './address-card'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Arriving in Nepal — your first 48 hours',
  description:
    'What to do in your first two days in Nepal: money, taxis, SIM cards, what to bargain ' +
    'for and what not to, and why day one should not be a sightseeing marathon.',
  alternates: { canonical: '/arrive' },
}

export default function ArrivePage() {
  return (
    <Container className="py-10">
      <h1 className="text-[32px] sm:text-[38px] font-bold tracking-tight leading-[1.15] max-w-2xl">
        Arriving in Nepal
      </h1>
      <p className="mt-4 text-[17px] text-[var(--color-ink-2)] max-w-2xl leading-relaxed">
        Your first two days are not about sightseeing. They are about working out how things
        run here, so that everything after is easy. This is what we would tell a friend
        getting off the plane.
      </p>

      {/* Lead with the counter-commercial advice. It is the most useful thing here
          and the clearest signal that nothing on this page is being sold. */}
      <section className="mt-9 max-w-2xl rounded-xl border border-[var(--color-line)]
                          border-l-[3px] border-l-[var(--color-crimson)]
                          bg-[var(--color-surface)] p-5">
        <h2 className="text-[19px] font-semibold tracking-tight mb-2">
          Do not make day one a sightseeing marathon
        </h2>
        <p className="text-[14.5px] text-[var(--color-ink-2)] leading-relaxed mb-2">
          Almost every itinerary you will be sold does this: airport, Pashupatinath, Boudha,
          Patan, Thamel, dinner, hotel. You have just spent a day in the air, you are at
          1,400 metres, and you will remember none of it.
        </p>
        <p className="text-[14.5px] text-[var(--color-ink-2)] leading-relaxed mb-2">
          A better first day: <strong className="text-[var(--color-ink)]">arrive, settle,
          shower, eat something good, walk around your own neighbourhood for an hour, sleep
          early.</strong> Start properly on day two, awake.
        </p>
        <p className="text-[13.5px] text-[var(--color-ink-3)] mb-0">
          Nobody sells this because nobody can bill for it. That is exactly why we can say it.
        </p>
      </section>

      <Section title="At the airport">
        <P>
          Get your visa before the queue builds — you can fill the arrival form online up to
          15 days before you fly, which skips the kiosk. Bring the fee in{' '}
          <strong>cash, in small notes</strong>: the card machines exist and they fail often.
          Full detail on{' '}
          <Link href="/how-to/tourist-visa-on-arrival" className="underline">the visa page</Link>.
        </P>
        <P>
          Change a small amount at the airport — enough for a taxi and dinner, not more. Rates
          are better in town. Check today&rsquo;s official rate on{' '}
          <Link href="/rates" className="underline">our rates page</Link> first so you know
          what you are comparing against; that is the central bank&rsquo;s number, not what
          a counter will actually give you.
        </P>
        <P>
          A SIM needs your passport — that is the law, not a shakedown, and nobody can sell
          you one without it.
        </P>
      </Section>

      <Section title="Getting to where you are staying">
        <P>
          There is a prepaid taxi counter inside arrivals and there are drivers outside. The
          counter costs a little more and involves no negotiation at midnight after a long
          flight, which is often worth it on day one.
        </P>
        <P>
          Agree the fare <em>before</em> the bags go in the boot. Meters exist and are mostly
          not used. Knowing the usual range is the whole game, so we publish it:{' '}
          <Link href="/prices" className="underline">what things cost</Link>.
        </P>
        <P>
          Pathao and inDrive work well in Kathmandu and Pokhara and remove the haggling
          entirely. You need data first, which is why the SIM comes before the taxi.
        </P>
      </Section>

      <Section title="Write your address in Nepali before you need it">
        <P>
          The single most common stuck moment: you are standing in front of a driver who
          cannot read the Latin name of your guesthouse. Make this card now, screenshot it,
          and you never have that problem.
        </P>
        <AddressCard />
      </Section>

      <Section title="Money, and what things cost">
        <P>
          Notes are 5, 10, 20, 50, 100, 500 and 1,000 rupees. Nobody can change a 1,000 for a
          20-rupee purchase, so break big notes at supermarkets and hotels and keep the small
          ones for tea, taxis and buses.
        </P>
        <P>
          ATMs charge their own fee per withdrawal on top of your bank&rsquo;s, so take out
          more, less often.
        </P>
        <P>
          On bargaining: it is normal in markets and for taxis, and not normal in restaurants,
          shops with marked prices, or supermarkets. And keep it in proportion — pushing a
          NPR 50 item down to NPR 30 is not a win. Twenty rupees matters more to the person
          handing it over than to the person keeping it.
        </P>
      </Section>

      <Section title="A few words that go a long way">
        <ul className="text-[15px] text-[var(--color-ink-2)] leading-relaxed space-y-1.5 pl-0 list-none">
          {[
            ['नमस्ते', 'Namaste', 'hello, and goodbye'],
            ['धन्यवाद', 'Dhanyabad', 'thank you'],
            ['कति हो?', 'Kati ho?', 'how much is it?'],
            ['महँगो भयो', 'Mahango bhayo', "that's expensive"],
            ['पर्दैन', 'Pardaina', "no thank you / I don't need it"],
            ['ठिक छ', 'Thik cha', "it's fine / okay"],
            ['पानी', 'Paani', 'water'],
            ['कहाँ छ?', 'Kaha cha?', 'where is it?'],
          ].map(([ne, rom, en]) => (
            <li key={rom} className="flex flex-wrap items-baseline gap-x-3">
              <span className="ne text-[17px] w-24 shrink-0">{ne}</span>
              <span className="font-medium">{rom}</span>
              <span className="text-[var(--color-ink-3)] text-[14px]">{en}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Being sensible, without being suspicious">
        <P>
          Nepal is a friendly country and most people who talk to you simply want to talk to
          you. A short list of the things that genuinely do happen, so you can relax about
          everything else:
        </P>
        <ul className="text-[14.5px] text-[var(--color-ink-2)] leading-relaxed space-y-2 pl-5">
          <li>Someone very helpful at the airport carrying your bag to a taxi, then charging
            for it. Decide before you accept.</li>
          <li>&ldquo;That temple is closed today, let me take you somewhere better&rdquo; —
            usually a shop where the driver earns a commission.</li>
          <li>Trekking gear sold as brand-name that is not. Fine if you know and the price
            reflects it; not fine at the brand price.</li>
          <li>A quoted price that changes once you are already moving. Agree first, out loud,
            and repeat the number back.</li>
        </ul>
        <P>
          If something goes properly wrong, the tourist police exist for exactly this and
          speak English: <Link href="/emergency" className="underline">emergency numbers</Link>.
        </P>
      </Section>

      <Section title="Altitude, if you are going up">
        <P>
          Kathmandu is 1,400 m and fine. Above roughly 2,500 m, ascend slowly and stop if you
          get a headache with nausea or unsteadiness. Going down is the treatment and it works
          immediately. Do not sleep on it and decide in the morning.
        </P>
      </Section>

      <div className="mt-12 max-w-2xl rounded-xl border border-[var(--color-line)]
                      bg-[var(--color-surface)] p-5">
        <h3 className="text-[15px] font-semibold mb-1.5">Nobody paid for a word of this</h3>
        <p className="text-[13.5px] text-[var(--color-ink-2)] mb-0">
          We take no commission from any hotel, driver, shop or agency — so nothing here is a
          recommendation someone bought.{' '}
          <Link href="/promise" className="underline">Our promise</Link>.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {[['/prices', 'What things cost'], ['/rates', 'Exchange rates'],
          ['/emergency', 'Emergency numbers'], ['/how-to/tourist-visa-on-arrival', 'Visa on arrival'],
          ['/holidays', 'What closes, and when']].map(([href, label]) => (
          <Link key={href} href={href}
            className="inline-block no-underline rounded-lg border border-[var(--color-line)]
                       bg-[var(--color-surface)] px-4 py-2.5 text-[14px]
                       hover:border-[var(--color-crimson)]">
            {label} →
          </Link>
        ))}
      </div>
    </Container>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-11 max-w-2xl">
      <h2 className="text-[20px] font-semibold tracking-tight mb-2.5">{title}</h2>
      {children}
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-[var(--color-ink-2)] leading-relaxed mb-3">{children}</p>
}
