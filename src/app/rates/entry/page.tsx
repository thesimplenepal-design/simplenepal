import Link from 'next/link'
import { cookies } from 'next/headers'
import { db } from '@/db'
import { metalRate } from '@/db/schema'
import { desc } from 'drizzle-orm'
import { Container } from '@/components/ui'
import { Login } from '@/app/capture/login'
import { nepalDateKey } from '@/lib/hours'
import { MetalForm } from './form'

export const dynamic = 'force-dynamic'
export const metadata = { robots: { index: false, follow: false } }

/**
 * The weekly gold and silver reading.
 *
 * Ten seconds, once a week, standing anywhere. That cadence is the whole design
 * constraint: an archive that depends on a daily chore will be abandoned by
 * March, and a weekly one gives fifty-two points a year, which is ample for the
 * monthly and yearly trends we actually publish.
 */
export default async function MetalEntryPage() {
  if ((await cookies()).get('sn_admin')?.value !== 'ok') return <Login />

  let recent: { date: string; metal: string; perTola: number }[] = []
  try {
    recent = await db
      .select({ date: metalRate.date, metal: metalRate.metal, perTola: metalRate.perTola })
      .from(metalRate).orderBy(desc(metalRate.date)).limit(12)
  } catch { /* no database */ }

  // Shown as placeholders so a slipped digit is obvious against last week's number.
  const last: Record<string, number> = {}
  for (const r of recent) if (!(r.metal in last)) last[r.metal] = r.perTola

  return (
    <Container className="py-10">
      <h1 className="text-[26px] font-bold tracking-tight">Weekly metal reading</h1>
      <p className="text-[14.5px] text-[var(--color-ink-2)] mt-2 max-w-md">
        Open{' '}
        <a href="https://www.fenegosida.org/" rel="nofollow noopener" className="underline">
          fenegosida.org
        </a>
        , read today&rsquo;s rates, type them here. Rupees per tola.
      </p>

      <MetalForm today={nepalDateKey()} last={last} />

      {recent.length > 0 && (
        <section className="mt-12 max-w-md">
          <h2 className="text-[15px] font-semibold tracking-tight mb-2.5">Recent readings</h2>
          <ul className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]
                         divide-y divide-[var(--color-line)] text-[13.5px]">
            {recent.map((r, i) => (
              <li key={i} className="px-3.5 py-2 flex justify-between gap-3">
                <span className="text-[var(--color-ink-3)]">{r.date}</span>
                <span className="text-[var(--color-ink-2)]">{r.metal.replace(/_/g, ' ')}</span>
                <span className="tabular-nums font-medium">{r.perTola.toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8">
        <Link href="/rates/gold" className="text-[14px] underline">See the charts →</Link>
      </div>
    </Container>
  )
}
