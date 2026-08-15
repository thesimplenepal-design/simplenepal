import { Container } from '@/components/ui'

export const metadata = { title: 'Claim your page', robots: { index: false, follow: true } }

/**
 * Deliberately a placeholder. Real claiming needs phone-OTP, and phone-OTP needs
 * an SMS gateway contract — both are Era 1 work, not week 1. Until then the
 * honest version is an email address a human actually reads.
 */
export default async function Claim({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return (
    <Container className="py-12 max-w-lg">
      <h1 className="text-[24px] font-bold tracking-tight">Claim this page</h1>
      <p className="mt-3 text-[15.5px] text-[var(--color-ink-2)] leading-relaxed">
        Owner verification by phone is coming. For now, email{' '}
        <a className="underline" href={`mailto:claim@simplenepal.com?subject=Claim: ${slug}`}>
          claim@simplenepal.com
        </a>{' '}
        from an address connected to the business, or call us — a person will confirm it
        with you and update the page the same day.
      </p>
      <p className="mt-4 text-[13.5px] text-[var(--color-ink-3)]">
        Claiming is free and always will be. What you can pay for later is being found —
        never for changing what your page says about you.
      </p>
    </Container>
  )
}
