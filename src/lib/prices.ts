/**
 * Turning observations into an honest published price.
 *
 * Three rules, and each of them is a rule about honesty rather than statistics:
 *
 * 1. A RANGE, never a single number. "A taxi costs NPR 900" is false the moment
 *    someone pays 850. "NPR 800–1,200" is true, and it also tells the reader how
 *    much room there is to negotiate — which is the thing they actually wanted.
 *
 * 2. MEDIAN, not mean. One driver charging a tourist NPR 3,000 should not drag
 *    the published figure upward and quietly legitimise itself.
 *
 * 3. A PUBLISH GATE. Fewer than three observations is an anecdote, and the site
 *    does not publish anecdotes as facts anywhere else either.
 */

export const MIN_OBSERVATIONS = 3

export type Observation = {
  amount: number
  context: 'airport' | 'tourist_area' | 'local_area' | 'online'
  observedAt: string
  placeNote: string | null
  note: string | null
  observedBy: string
}

export type PriceSummary = {
  published: boolean
  n: number
  /** Observations set aside as outliers. Shown, never hidden. */
  excluded: number
  low: number
  high: number
  typical: number          // median
  lastCheckedAt: string
  /** Split out because the gap between these two is the useful part. */
  byContext: { context: Observation['context']; n: number; typical: number }[]
  spread: number           // high / low, e.g. 2.4 means the top is 2.4x the bottom
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2)
}

/**
 * The 10th–90th percentile, not the raw min and max.
 *
 * A published range has to survive one absurd data point in either direction —
 * the airport tout quoting 5,000, or the one time a friend's cousin did it for
 * nothing. With few observations this degrades gracefully to the real extremes.
 */
export function range(xs: number[]): [number, number] {
  if (xs.length === 0) return [0, 0]
  const s = [...xs].sort((a, b) => a - b)
  if (s.length < 5) return [s[0], s[s.length - 1]]
  const at = (p: number) => s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]
  return [at(0.1), at(0.9)]
}

/**
 * Set aside observations that are not really the same transaction.
 *
 * Someone quoted NPR 5,000 for a NPR 1,000 taxi was not overcharged for a taxi;
 * they were offered a different, imaginary product. Leaving it in makes the
 * published range read "NPR 900–5,000", which is useless to the visitor and
 * unfair to every honest driver in the list.
 *
 * But it is not silently dropped either — the count is published, because
 * quietly deleting inconvenient data is exactly what this site exists not to do.
 * Threshold is deliberately loose: only things far outside the cluster go.
 */
const OUTLIER_FACTOR = 3

function outlierBounds(amounts: number[]): { lo: number; hi: number } | null {
  if (amounts.length < 3) return null
  const m = median(amounts)
  if (m <= 0) return null

  const lo = m / OUTLIER_FACTOR
  const hi = m * OUTLIER_FACTOR
  const keptCount = amounts.filter((a) => a >= lo && a <= hi).length

  // An outlier has to be a MINORITY, strictly. Prices here are genuinely
  // bimodal — dal bhat is NPR 150 in a local kitchen and NPR 600 in Thamel, and
  // both are true. A filter that discards half the observations would delete one
  // of those two realities and call the survivor the price. If the split is even,
  // keep everything: a wide range is the honest answer.
  if (keptCount * 2 <= amounts.length) return null
  return { lo, hi }
}

export function summarise(obs: Observation[]): PriceSummary | null {
  if (obs.length === 0) return null

  const all = obs.map((o) => o.amount).filter((n) => Number.isFinite(n) && n >= 0)
  if (all.length === 0) return null

  const bounds = outlierBounds(all)
  const inRange = (a: number) => !bounds || (a >= bounds.lo && a <= bounds.hi)
  const amounts = all.filter(inRange)
  const excluded = all.length - amounts.length

  const [low, high] = range(amounts)
  const typical = median(amounts)

  const contexts: Observation['context'][] = ['airport', 'tourist_area', 'local_area', 'online']
  const byContext = contexts
    .map((c) => {
      const xs = obs.filter((o) => o.context === c && inRange(o.amount)).map((o) => o.amount)
      return { context: c, n: xs.length, typical: median(xs) }
    })
    .filter((c) => c.n > 0)

  const lastCheckedAt = obs.reduce((a, o) => (o.observedAt > a ? o.observedAt : a), obs[0].observedAt)

  return {
    published: amounts.length >= MIN_OBSERVATIONS,
    n: amounts.length,
    excluded,
    low, high, typical, lastCheckedAt, byContext,
    spread: low > 0 ? Number((high / low).toFixed(1)) : 0,
  }
}

export const CONTEXT_LABEL: Record<Observation['context'], { en: string; why: string }> = {
  airport: {
    en: 'At the airport',
    why: 'Captive demand and a long wait between fares. Dearer here is normal, not a scam.',
  },
  tourist_area: {
    en: 'Tourist area',
    why: 'Thamel or Lakeside rent, longer hours, and English spoken. That costs the business money.',
  },
  local_area: {
    en: 'Local area',
    why: 'What a resident pays. Not always available to a visitor, and not always fair to expect.',
  },
  online: {
    en: 'App or published tariff',
    why: 'Pathao, inDrive or an official rate card. Usually the cleanest number to argue from.',
  },
}

/** 'NPR 800–1,200' or 'NPR 950' when the range collapses. */
export function formatRange(low: number, high: number): string {
  const f = (n: number) => n.toLocaleString('en-US')
  return low === high ? `NPR ${f(low)}` : `NPR ${f(low)}–${f(high)}`
}

export function daysSince(iso: string, now: Date = new Date()): number {
  const then = Date.parse(`${iso}T00:00:00Z`)
  const today = Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`)
  return Math.max(0, Math.round((today - then) / 86_400_000))
}

/**
 * Prices go stale quietly, which is worse than going stale loudly. Anything
 * older than a season should say so rather than sitting there looking current.
 */
export function freshness(days: number): 'fresh' | 'ageing' | 'stale' {
  if (days <= 90) return 'fresh'
  if (days <= 240) return 'ageing'
  return 'stale'
}
