import Link from 'next/link'
import { daysUntilStale } from '@/lib/quality'

export function Container({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-5xl px-4 ${className}`}>{children}</div>
}

export function Breadcrumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-[var(--color-ink-3)] mb-3">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-[var(--color-line)]">/</span>}
            {it.href ? (
              <Link href={it.href} className="no-underline hover:text-[var(--color-crimson)]">{it.label}</Link>
            ) : (
              <span className="text-[var(--color-ink-2)]">{it.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

/**
 * The provenance chip. This is the single most important component on the site —
 * it is the visible difference between us and a scraped directory, and it is a
 * claim no language model can make about its own output.
 */
export function ProvenanceChip({
  verifiedAt, verifiedBy, sourceLabel,
}: { verifiedAt?: Date | null; verifiedBy?: string | null; sourceLabel?: string | null }) {
  if (!verifiedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] text-[var(--color-ink-3)]
                       border border-[var(--color-line)] rounded-full px-2.5 py-1">
        Not yet verified in person
      </span>
    )
  }
  const left = daysUntilStale(verifiedAt)
  const stale = left !== null && left <= 0
  const d = new Date(verifiedAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[12px] rounded-full px-2.5 py-1 border"
      style={{
        color: stale ? 'var(--color-ink-3)' : 'var(--color-verified)',
        borderColor: stale ? 'var(--color-line)' : 'color-mix(in srgb, var(--color-verified) 35%, transparent)',
      }}
      title={sourceLabel ?? undefined}
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path d="M3 8.5l3.2 3.2L13 5" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {stale ? `Last checked ${d} — due a re-check` : `Checked in person ${d}`}
      {verifiedBy && !stale ? ` by ${verifiedBy}` : ''}
    </span>
  )
}

export function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
      <div className="text-[19px] font-semibold tracking-tight leading-tight">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-[var(--color-ink-3)] mt-1">{label}</div>
    </div>
  )
}

export function EmptyState({ title, body }: { title: string; body: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-line)] px-5 py-8 text-center">
      <p className="font-medium text-[15px]">{title}</p>
      <p className="text-[13.5px] text-[var(--color-ink-2)] mt-1.5 max-w-md mx-auto">{body}</p>
    </div>
  )
}

export const KIND_LABEL: Record<string, { en: string; ne: string }> = {
  metropolitan:        { en: 'Metropolitan City',     ne: 'महानगरपालिका' },
  sub_metropolitan:    { en: 'Sub-Metropolitan City', ne: 'उपमहानगरपालिका' },
  municipality:        { en: 'Municipality',          ne: 'नगरपालिका' },
  rural_municipality:  { en: 'Rural Municipality',    ne: 'गाउँपालिका' },
}
