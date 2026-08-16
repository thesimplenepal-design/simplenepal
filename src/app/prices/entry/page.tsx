import Link from 'next/link'
import { cookies } from 'next/headers'
import { Container } from '@/components/ui'
import { Login } from '@/app/capture/login'
import { itemsForEntry, recentObservations } from '@/db/price-queries'
import { nepalDateKey } from '@/lib/hours'
import { PriceForm } from './form'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

/**
 * Recording a price, on a phone, immediately after paying it.
 *
 * The design constraint is that this happens standing in the street with change
 * still in your hand. One screen, a keypad, four taps.
 */
export default async function PriceEntryPage() {
  if ((await cookies()).get('sn_admin')?.value !== 'ok') return <Login />

  let items: Awaited<ReturnType<typeof itemsForEntry>> = []
  let recent: Awaited<ReturnType<typeof recentObservations>> = []
  try {
    items = await itemsForEntry()
    recent = await recentObservations(15)
  } catch { /* no database */ }

  return (
    <Container className="py-10">
      <h1 className="text-[26px] font-bold tracking-tight">Record a price</h1>
      <p className="text-[14.5px] text-[var(--color-ink-2)] mt-2 max-w-md">
        Right after you pay, while you still remember it exactly. Three observations of the same
        thing before it publishes.
      </p>

      {items.length === 0 ? (
        <p className="text-[14px] text-[var(--color-ink-2)] mt-6">
          No items yet — run <code>npm run seed:prices</code>.
        </p>
      ) : (
        <PriceForm items={items} today={nepalDateKey()} />
      )}

      {recent.length > 0 && (
        <section className="mt-12 max-w-md">
          <h2 className="text-[15px] font-semibold tracking-tight mb-2.5">Last recorded</h2>
          <ul className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]
                         divide-y divide-[var(--color-line)] text-[13.5px]">
            {recent.map((r, i) => (
              <li key={i} className="px-3.5 py-2.5">
                <div className="flex justify-between gap-3">
                  <span className="text-[var(--color-ink-2)] min-w-0 truncate">{r.name}</span>
                  <span className="tabular-nums font-medium shrink-0">
                    {r.amount.toLocaleString()}
                  </span>
                </div>
                <div className="text-[12px] text-[var(--color-ink-3)]">
                  {r.context.replace(/_/g, ' ')}
                  {r.placeNote ? ` · ${r.placeNote}` : ''} · {r.observedAt}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8">
        <Link href="/prices" className="text-[14px] underline">See the published page →</Link>
      </div>
    </Container>
  )
}
