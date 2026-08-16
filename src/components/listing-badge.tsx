/**
 * The single most important component on the directory pages.
 *
 * The site's footer promises that every record was checked by a person. That
 * promise survives importing government registers only if a listing and a visit
 * can never be mistaken for one another — so this is the one place the
 * distinction is rendered, and every directory uses it.
 *
 * "Listed in the UGC register" means: this exists, a government body says so,
 * and we have not been there.
 * "Verified" means: somebody stood in front of it.
 */
export function ListingBadge({
  verified, verifiedBy, registryName,
}: { verified: boolean; verifiedBy: string | null; registryName: string | null }) {
  if (verified) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] rounded-full px-2 py-0.5
                       border border-emerald-700/30 bg-emerald-50 text-emerald-900
                       dark:bg-emerald-950/30 dark:text-emerald-300">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" aria-hidden />
        Visited{verifiedBy ? ` by ${verifiedBy}` : ''}
      </span>
    )
  }

  if (registryName) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11.5px] rounded-full px-2 py-0.5
                       border border-[var(--color-line)] text-[var(--color-ink-3)]">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-ink-3)]/50" aria-hidden />
        Listed in the {registryName} register — not visited
      </span>
    )
  }

  return (
    <span className="text-[11.5px] rounded-full px-2 py-0.5 border border-[var(--color-line)]
                     text-[var(--color-ink-3)]">
      Unchecked
    </span>
  )
}

/** The standing explanation, shown once at the top of every directory. */
export function ListingExplainer({ registry, what }: { registry: string; what: string }) {
  return (
    <div className="mt-7 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]
                    p-5 max-w-2xl">
      <h2 className="text-[16px] font-semibold tracking-tight mb-2">
        Listed is not the same as checked
      </h2>
      <p className="text-[14px] text-[var(--color-ink-2)] leading-relaxed mb-2">
        Most {what} here come from the <strong>{registry}</strong> register. That tells you the
        place exists and that an official body says so. It does not tell you the phone number
        still works, the address is right, or what it is actually like — because nobody from
        SimpleNepal has been there.
      </p>
      <p className="text-[14px] text-[var(--color-ink-2)] leading-relaxed mb-0">
        When somebody does visit, the entry gets a <em>Visited</em> mark, the name of whoever
        checked it, and its own page. Until then it stays a listing, and we say so on every row.
        A list of names dressed up as verified records would be the one lie this site cannot
        afford.
      </p>
    </div>
  )
}
