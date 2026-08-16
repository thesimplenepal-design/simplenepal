import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/site'
import { DesktopNav, MobileNav, FooterNav } from '@/components/nav'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'SimpleNepal — Nepal, made simple',
    template: '%s · SimpleNepal',
  },
  description:
    'A verified, structured guide to Nepal: every province, district and local level, ' +
    'and the places and businesses inside them — checked in person.',
  openGraph: { siteName: 'SimpleNepal', type: 'website', locale: 'en_NP' },
  alternates: { canonical: '/' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <header className="border-b border-[var(--color-line)] sticky top-0 z-40
                           bg-[var(--color-paper)]/90 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 h-14 flex items-center gap-3">
            <Link href="/" className="font-bold tracking-tight text-[15px] no-underline shrink-0">
              Simple<span className="text-[var(--color-crimson)]">Nepal</span>
            </Link>

            {/* The search field gave up the whole header on a phone and left no
                room for anything else. It stays, but it yields. */}
            <form action="/search" className="flex-1 min-w-0 max-w-md">
              <input
                name="q"
                type="search"
                placeholder="Search Nepal…"
                aria-label="Search"
                className="w-full h-10 px-3 rounded-lg border border-[var(--color-line)]
                           bg-[var(--color-surface)] text-[16px] sm:text-[14px]
                           placeholder:text-[var(--color-ink-3)]"
              />
            </form>

            <DesktopNav />
            <MobileNav />
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-[var(--color-line)] mt-16">
          <div className="mx-auto max-w-5xl px-4 py-8 text-[13px] text-[var(--color-ink-3)] space-y-4">
            <FooterNav />
            <p className="mb-0">
              <strong className="text-[var(--color-ink-2)]">SimpleNepal</strong> — every record here was
              checked by a person, and says who checked it and when.
            </p>
            <p className="mb-0">
              Administrative data (7 provinces · 77 districts · 753 local levels · 6,743 wards) from{' '}
              <a href="https://github.com/sagautam5/local-states-nepal" className="underline">
                local-states-nepal
              </a>{' '}
              (MIT).
            </p>
          </div>
        </footer>
      </body>
    </html>
  )
}
