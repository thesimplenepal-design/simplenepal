import Link from 'next/link'

/**
 * Site navigation.
 *
 * Most of Nepal's internet is a phone, so the mobile case is the real case, not
 * the fallback — and until now the nav was `hidden sm:flex`, meaning every tool
 * on this site was invisible to the majority of visitors.
 *
 * Built on <details>, so it costs zero client JavaScript: the menu opens and
 * closes natively, works before hydration, works with JS disabled entirely, and
 * needs no state. On a slow connection an interactive menu that only works
 * after a 200kB bundle arrives is a menu that does not work.
 */

export const NAV = [
  { href: '/how-to', label: 'How to', hint: 'Government services, step by step' },
  { href: '/gov', label: 'Government', hint: 'Ministries, departments and offices' },
  { href: '/rates', label: 'Rates', hint: 'Official exchange rates' },
  { href: '/holidays', label: 'Holidays', hint: 'What closes, and when' },
  { href: '/date', label: 'Date', hint: 'Bikram Sambat converter' },
  { href: '/emergency', label: 'Emergency', hint: 'Police, ambulance, tourist police' },
] as const

export function DesktopNav() {
  return (
    <nav className="ml-auto hidden md:flex gap-4 text-[13.5px] text-[var(--color-ink-2)]">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} className="no-underline hover:text-[var(--color-crimson)]">
          {n.label}
        </Link>
      ))}
    </nav>
  )
}

export function MobileNav() {
  return (
    <details className="md:hidden ml-auto relative group">
      <summary
        className="list-none cursor-pointer select-none flex items-center gap-1.5
                   h-10 px-3 -mr-1 rounded-lg border border-[var(--color-line)]
                   bg-[var(--color-surface)] text-[13.5px] font-medium
                   [&::-webkit-details-marker]:hidden"
        aria-label="Menu"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden className="shrink-0">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.7"
                strokeLinecap="round" className="group-open:hidden" />
          <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.7"
                strokeLinecap="round" className="hidden group-open:block" />
        </svg>
        Menu
      </summary>

      {/* Full-width panel below the header. Each row is a 48px tap target — the
          size a thumb actually hits, not the size text happens to be. */}
      <div className="fixed left-0 right-0 top-14 z-50 border-y border-[var(--color-line)]
                      bg-[var(--color-paper)] shadow-lg max-h-[calc(100vh-3.5rem)] overflow-y-auto">
        <ul className="divide-y divide-[var(--color-line)]">
          {NAV.map((n) => (
            <li key={n.href}>
              <Link href={n.href}
                className="flex flex-col justify-center no-underline px-4 min-h-12 py-2.5
                           active:bg-[var(--color-surface-2)]">
                <span className="text-[15.5px] font-medium leading-tight">{n.label}</span>
                <span className="text-[12.5px] text-[var(--color-ink-3)] leading-tight mt-0.5">
                  {n.hint}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </details>
  )
}

/** Repeated in the footer, so the links exist even when the menu is closed. */
export function FooterNav() {
  return (
    <nav className="flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href}
          className="no-underline text-[var(--color-ink-2)] hover:text-[var(--color-crimson)]">
          {n.label}
        </Link>
      ))}
    </nav>
  )
}
