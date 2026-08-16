import Link from 'next/link'
import type { Metadata } from 'next'
import { Container } from '@/components/ui'

// Nothing here comes from the database and none of it changes often, so this
// page is fully static — it renders from the edge with no query, which matters
// because the moment someone needs it is the moment their connection is worst.
export const dynamic = 'force-static'

export const metadata: Metadata = {
  title: 'Emergency numbers in Nepal — police, ambulance, tourist police',
  description:
    'Emergency phone numbers in Nepal and where the tourist police are posted. ' +
    'Police 100, fire 101, ambulance 102, tourist police 1144.',
  alternates: { canonical: '/emergency' },
}

const CORE = [
  { n: '100', label: 'Police', note: 'Nationwide, 24 hours' },
  { n: '101', label: 'Fire', note: null },
  { n: '102', label: 'Ambulance', note: 'Coverage varies outside cities' },
  { n: '1144', label: 'Tourist police', note: 'Toll-free hotline' },
  { n: '103', label: 'Traffic police', note: 'Road incidents' },
]

const POSTS: [string, [string, string][]][] = [
  ['Kathmandu', [
    ['Bhrikutimandap (head office)', '9851289445'],
    ['Thamel', '9851289453'],
    ['Airport', '9851289450'],
    ['Basantapur', '9851289454'],
    ['Pashupati', '9851289446'],
    ['Bouddha', '9851289451'],
    ['Swoyambhu', '9851289452'],
  ]],
  ['Lalitpur', [['Patan', '9851289449']]],
  ['Bhaktapur', [['Bhaktapur', '9851289448'], ['Nagarkot', '9851289447']]],
]

export default function EmergencyPage() {
  return (
    <Container className="py-10">
      <h1 className="text-[32px] sm:text-[38px] font-bold tracking-tight leading-[1.15] max-w-2xl">
        Emergency numbers
      </h1>
      <p className="mt-4 text-[17px] text-[var(--color-ink-2)] max-w-2xl leading-relaxed">
        Save these before you need them. They work from any Nepali SIM, and the three-digit
        numbers work without credit.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-8 max-w-3xl">
        {CORE.map((c) => (
          <a key={c.n} href={`tel:${c.n}`}
             className="block no-underline rounded-xl border border-[var(--color-line)]
                        bg-[var(--color-surface)] px-4 py-4 hover:border-[var(--color-crimson)]
                        transition-colors">
            <div className="text-[30px] font-bold tracking-tight tabular-nums leading-none">{c.n}</div>
            <div className="text-[14px] font-medium mt-1.5">{c.label}</div>
            {c.note && <div className="text-[12px] text-[var(--color-ink-3)] mt-0.5">{c.note}</div>}
          </a>
        ))}
      </div>

      <p className="text-[13px] text-[var(--color-ink-3)] mt-4 max-w-2xl">
        Tap a number to dial it.
      </p>

      <section className="mt-12 max-w-2xl">
        <h2 className="text-[20px] font-semibold tracking-tight mb-1">Tourist police</h2>
        <p className="text-[13.5px] text-[var(--color-ink-2)] mb-4">
          A separate unit that deals with visitors — theft, lost passports, disputes with
          operators, and getting you to the right place when something goes wrong. English is
          spoken. Posts are staffed around the clock in the Kathmandu valley and Pokhara, and the
          unit operates in all seven provinces.
        </p>

        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]
                        divide-y divide-[var(--color-line)]">
          {POSTS.map(([district, list]) => (
            <div key={district} className="px-4 py-3">
              <div className="text-[11.5px] uppercase tracking-wider text-[var(--color-ink-3)] mb-1.5">
                {district}
              </div>
              <ul className="space-y-1.5">
                {list.map(([place, phone]) => (
                  <li key={place} className="flex items-baseline justify-between gap-3">
                    <span className="text-[14px]">{place}</span>
                    <a href={`tel:+977${phone}`} className="text-[14px] tabular-nums underline shrink-0">
                      {phone}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="text-[12.5px] text-[var(--color-ink-3)] mt-3">
          Head office: Bhrikutimandap, Kathmandu · +977-1-5347041 ·{' '}
          <a href="mailto:policetourist@nepalpolice.gov.np" className="underline">
            policetourist@nepalpolice.gov.np
          </a>
        </p>
      </section>

      <section className="mt-12 max-w-2xl">
        <h2 className="text-[20px] font-semibold tracking-tight mb-3">If you are in the mountains</h2>
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
          <p className="text-[14.5px] text-[var(--color-ink-2)] leading-relaxed mb-2">
            Mobile coverage is patchy above the treeline and an ambulance cannot reach most trails.
            Evacuation means a helicopter, and a helicopter means someone guaranteeing payment
            before it lifts.
          </p>
          <p className="text-[14.5px] text-[var(--color-ink-2)] leading-relaxed mb-2">
            <strong className="text-[var(--color-ink)]">Before you walk:</strong> carry your
            insurance policy number and its 24-hour emergency line written on paper, not only on a
            phone. Tell your guide, your lodge, or someone at home your route and expected dates.
          </p>
          <p className="text-[14.5px] text-[var(--color-ink-2)] leading-relaxed mb-0">
            <strong className="text-[var(--color-ink)]">Altitude sickness kills people who keep
            climbing.</strong> If someone has a headache with vomiting, loses coordination, or is
            confused, going down is the treatment. Descend immediately — it is not something to
            sleep on and reassess in the morning.
          </p>
        </div>
      </section>

      <section className="mt-12 max-w-2xl">
        <h2 className="text-[20px] font-semibold tracking-tight mb-2">Your embassy</h2>
        <p className="text-[14.5px] text-[var(--color-ink-2)] leading-relaxed">
          For a lost passport, an arrest, a death, or a serious hospitalisation, contact your own
          country&rsquo;s mission. We don&rsquo;t reproduce embassy contact details here — there
          are around thirty in Kathmandu, they move and change numbers, and a wrong number on this
          page would be worst exactly when it matters most.
        </p>
        <p className="text-[14.5px] text-[var(--color-ink-2)] leading-relaxed mb-0">
          Nepal&rsquo;s Ministry of Foreign Affairs keeps the current list of diplomatic missions:{' '}
          <a href="https://mofa.gov.np/diplomatic-missions/foreign-diplomatic-missions-in-nepal/"
             rel="nofollow noopener" className="underline">mofa.gov.np</a>. Look yours up now and
          save the number while you have signal.
        </p>
      </section>

      <div className="mt-12 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 max-w-2xl">
        <h3 className="text-[15px] font-semibold mb-1.5">Where these came from</h3>
        <p className="text-[13.5px] text-[var(--color-ink-2)] mb-0">
          The three-digit numbers and the tourist police posts are published by the{' '}
          <a href="https://ntb.gov.np/en/plan-your-trip/before-you-come/tourist-police"
             rel="nofollow noopener" className="underline">Nepal Tourism Board</a>, and the fire
          and ambulance numbers are corroborated by the{' '}
          <a href="https://np.usembassy.gov/emergency-assistance/" rel="nofollow noopener"
             className="underline">US Embassy in Kathmandu</a>. If a number here is wrong,{' '}
          <a href="mailto:fix@simplenepal.com?subject=Correction: emergency numbers"
             className="underline">tell us</a> — we will fix it the same day.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/how-to/trekking-permits"
          className="inline-block no-underline rounded-lg border border-[var(--color-line)]
                     bg-[var(--color-surface)] px-4 py-2.5 text-[14px] hover:border-[var(--color-crimson)]">
          Trekking permits →
        </Link>
        <Link href="/how-to/tourist-visa-on-arrival"
          className="inline-block no-underline rounded-lg border border-[var(--color-line)]
                     bg-[var(--color-surface)] px-4 py-2.5 text-[14px] hover:border-[var(--color-crimson)]">
          Visa on arrival →
        </Link>
      </div>
    </Container>
  )
}
