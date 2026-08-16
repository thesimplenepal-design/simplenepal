import Link from 'next/link'
import type { Metadata } from 'next'
import { db } from '@/db'
import { service } from '@/db/schema'
import { asc } from 'drizzle-orm'
import { Container, EmptyState } from '@/components/ui'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'How to get things done in Nepal — government services explained',
  description:
    'Step by step guides to Nepali government services: what to bring, what it costs, ' +
    'which office, and whether you can do it online.',
  alternates: { canonical: '/how-to' },
}

const CATEGORY_LABEL: Record<string, { en: string; ne: string }> = {
  identity: { en: 'Identity', ne: 'परिचय' },
  civil_registration: { en: 'Births, deaths & marriage', ne: 'व्यक्तिगत घटना दर्ता' },
  land: { en: 'Land', ne: 'जग्गा' },
  vehicle: { en: 'Vehicles & licences', ne: 'सवारी' },
  business: { en: 'Business & tax', ne: 'व्यवसाय' },
  education: { en: 'Education', ne: 'शिक्षा' },
  health: { en: 'Health', ne: 'स्वास्थ्य' },
  social_security: { en: 'Social security', ne: 'सामाजिक सुरक्षा' },
  visitor: { en: 'Visiting Nepal', ne: 'नेपाल भ्रमण' },
  other: { en: 'Other', ne: 'अन्य' },
}

export default async function HowToIndex() {
  let services: { slug: string; nameEn: string; nameNe: string | null; category: string;
                  summaryEn: string | null; published: boolean }[] = []
  try {
    services = await db.select({
      slug: service.slug, nameEn: service.nameEn, nameNe: service.nameNe,
      category: service.category, summaryEn: service.summaryEn, published: service.published,
    }).from(service).orderBy(asc(service.sort))
  } catch { /* build without a database */ }

  const byCategory = services.reduce<Record<string, typeof services>>((acc, s) => {
    (acc[s.category] ??= []).push(s)
    return acc
  }, {})

  return (
    <Container className="py-10">
      <h1 className="text-[32px] sm:text-[38px] font-bold tracking-tight leading-[1.15] max-w-2xl">
        How to get things done
      </h1>
      <p className="mt-4 text-[17px] text-[var(--color-ink-2)] max-w-2xl leading-relaxed">
        What to bring, what it costs, which office, and whether you can do it online.
        Every fact says when we last checked it and where.
      </p>

      {services.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Nothing published yet"
            body="We're building these one at a time, properly — steps, documents, fee with a source, and a walkthrough at a real counter. Twenty done well beats two hundred done thinly."
          />
        </div>
      ) : (
        Object.entries(byCategory).map(([cat, list]) => (
          <section key={cat} className="mt-10">
            <h2 className="text-[18px] font-semibold tracking-tight mb-1">
              {CATEGORY_LABEL[cat]?.en ?? cat}
              <span className="ne text-[var(--color-ink-3)] font-normal text-[14px] ml-2">
                {CATEGORY_LABEL[cat]?.ne}
              </span>
            </h2>
            <ul className="grid sm:grid-cols-2 gap-2.5 mt-3">
              {list.map((s) => (
                <li key={s.slug}>
                  <Link href={`/how-to/${s.slug}`}
                    className="block no-underline rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]
                               px-4 py-3 hover:border-[var(--color-crimson)] transition-colors h-full">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-medium text-[15px]">{s.nameEn}</span>
                      {s.nameNe && <span className="ne text-[13.5px] text-[var(--color-ink-3)]">{s.nameNe}</span>}
                      {!s.published && (
                        <span className="text-[10px] uppercase tracking-wider text-[var(--color-ink-3)]
                                         border border-[var(--color-line)] rounded-full px-2 py-0.5">draft</span>
                      )}
                    </div>
                    {s.summaryEn && (
                      <p className="text-[13px] text-[var(--color-ink-2)] mt-1.5 mb-0 line-clamp-2">
                        {s.summaryEn.slice(0, 130)}…
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </Container>
  )
}
