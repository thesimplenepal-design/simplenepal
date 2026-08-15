import type { OpenState, Schedule } from '@/lib/hours'

const TONE: Record<OpenState['status'], string> = {
  open: 'border-l-emerald-600 bg-emerald-50/60 dark:bg-emerald-950/20',
  closed: 'border-l-[var(--color-crimson)] bg-[var(--color-crimson-soft)]',
  maybe: 'border-l-amber-500 bg-amber-50/70 dark:bg-amber-950/20',
}

const DOT: Record<OpenState['status'], string> = {
  open: 'bg-emerald-600', closed: 'bg-[var(--color-crimson)]', maybe: 'bg-amber-500',
}

/**
 * The banner that answers the only question a citizen has before setting off.
 * It always shows *why*, because "closed" without a reason is the kind of claim
 * people stop trusting the first time it's wrong.
 */
export function OpenToday({ state, schedule }: { state: OpenState; schedule: Schedule }) {
  return (
    <div className={`mt-5 rounded-xl border border-[var(--color-line)] border-l-[3px] px-4 py-3.5 ${TONE[state.status]}`}>
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[state.status]}`} aria-hidden />
        <span className="text-[15px] font-semibold tracking-tight">{state.headline}</span>
        {state.hours && (
          <span className="text-[13.5px] text-[var(--color-ink-2)] ml-auto tabular-nums">{state.hours}</span>
        )}
      </div>

      {state.detail && (
        <p className="text-[13.5px] text-[var(--color-ink-2)] mt-1.5 mb-0">{state.detail}</p>
      )}

      <p className="text-[12px] text-[var(--color-ink-3)] mt-2 mb-0">
        {state.weekdayEn} <span className="ne">{state.weekdayNe}</span>
        {' · '}
        Offices open {schedule.openDays.length} days a week
        {schedule.sourceUrl ? (
          <>
            {' · '}
            <a href={schedule.sourceUrl} rel="nofollow noopener" className="underline">
              how we know
            </a>
          </>
        ) : null}
      </p>
    </div>
  )
}
