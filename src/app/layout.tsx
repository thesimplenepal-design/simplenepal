import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_URL } from '@/lib/site'
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
        <header className="border-b border-[var(--color-line)] sticky top-0 z-40 bg-[var(--color-paper)]/90 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 h-14 flex items-center gap-4">
            <Link href="/" className="font-bold tracking-tight text-[15px] no-underline">
              Simple<span className="text-[var(--color-crimson)]">Nepal</span>
            </Link>
            <form action="/search" className="flex-1 max-w-md">
              <input
                name="q"
                type="search"
                placeholder="Search places, food, hotels…"
                aria-label="Search"
                className="w-full h-9 px-3 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]
                           text-[14px] placeholder:text-[var(--color-ink-3)]"
              />
            </form>
            <nav className="ml-auto hidden sm:flex gap-4 text-[13.5px] text-[var(--color-ink-2)]">
              <Link href="/how-to" className="no-underline hover:text-[var(--color-crimson)]">How to</Link>
              <Link href="/gov" className="no-underline hover:text-[var(--color-crimson)]">Government</Link>
              <Link href="/rates" className="no-underline hover:text-[var(--color-crimson)]">Rates</Link>
              <Link href="/holidays" className="no-underline hover:text-[var(--color-crimson)]">Holidays</Link>
              <Link href="/date" className="no-underline hover:text-[var(--color-crimson)]">Date</Link>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-[var(--color-line)] mt-16">
          <div className="mx-auto max-w-5xl px-4 py-8 text-[13px] text-[var(--color-ink-3)] space-y-2">
            <p>
              <strong className="text-[var(--color-ink-2)]">SimpleNepal</strong> — every record here was
              checked by a person, and says who checked it and when.
            </p>
            <p>
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
