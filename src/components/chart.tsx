/**
 * A line chart rendered as SVG on the server.
 *
 * No charting library and no client JavaScript: this is a picture of numbers,
 * and shipping 50kB of Recharts to a phone on a 3G connection in Surkhet to
 * draw one line is a bad trade. It also means the chart appears in the initial
 * HTML, so it is visible to search engines and to anyone with JS disabled.
 */

export type Point = { date: string; value: number }

type Props = {
  points: Point[]
  height?: number
  stroke?: string
  fill?: string
  /** Rendered under the chart; e.g. 'NPR per tola'. */
  unit?: string
  label?: string
}

const W = 720   // viewBox width; the SVG scales to its container

export function LineChart({
  points, height = 200, stroke = 'var(--color-crimson, #b8003c)',
  fill = 'rgba(184,0,60,0.07)', unit, label,
}: Props) {
  if (points.length < 2) {
    return (
      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-8 text-center">
        <p className="text-[13.5px] text-[var(--color-ink-3)] mb-0">
          Not enough readings yet to draw a trend
          {points.length === 1 ? ' — one so far' : ''}. Charts need at least two.
        </p>
      </div>
    )
  }

  const H = height
  const padL = 52, padR = 12, padT = 12, padB = 26
  const values = points.map((p) => p.value)
  const rawMin = Math.min(...values), rawMax = Math.max(...values)
  const { min, max, ticks } = niceScale(rawMin, rawMax)

  const x = (i: number) => padL + (i / (points.length - 1)) * (W - padL - padR)
  const y = (v: number) => padT + (1 - (v - min) / (max - min || 1)) * (H - padT - padB)

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)},${(H - padB).toFixed(1)} L${x(0).toFixed(1)},${(H - padB).toFixed(1)} Z`

  const first = points[0], last = points[points.length - 1]
  const change = last.value - first.value
  const pct = first.value !== 0 ? (change / first.value) * 100 : 0

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img"
           aria-label={`${label ?? 'Trend'} from ${fmtDate(first.date)} to ${fmtDate(last.date)}: ${first.value.toLocaleString()} to ${last.value.toLocaleString()} ${unit ?? ''}`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)}
                  stroke="currentColor" strokeOpacity={0.1} strokeWidth={1} />
            <text x={padL - 8} y={y(t) + 3.5} textAnchor="end"
                  fontSize={10.5} fill="currentColor" fillOpacity={0.45}>
              {compact(t)}
            </text>
          </g>
        ))}

        <path d={area} fill={fill} stroke="none" />
        <path d={line} fill="none" stroke={stroke} strokeWidth={2}
              strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(points.length - 1)} cy={y(last.value)} r={3.5} fill={stroke} />

        <text x={padL} y={H - 8} fontSize={10.5} fill="currentColor" fillOpacity={0.45}>
          {fmtDate(first.date)}
        </text>
        <text x={W - padR} y={H - 8} textAnchor="end" fontSize={10.5} fill="currentColor" fillOpacity={0.45}>
          {fmtDate(last.date)}
        </text>
      </svg>

      <figcaption className="text-[12.5px] text-[var(--color-ink-3)] mt-2 flex flex-wrap gap-x-3">
        <span>{points.length} readings</span>
        <span>
          {change >= 0 ? '↑' : '↓'} {Math.abs(change).toLocaleString(undefined, { maximumFractionDigits: 2 })}
          {unit ? ` ${unit}` : ''} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
        </span>
        <span className="text-[var(--color-ink-3)]">over this period</span>
      </figcaption>
    </figure>
  )
}

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  })
}

/** 160500 → '160.5k'. Axis labels must not push the plot area off the chart. */
function compact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(n % 1000 === 0 ? 0 : 1)}k`
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

/**
 * Round the axis to human numbers. A gold chart running 158,432–161,207 should
 * show gridlines at 158k, 159k, 160k, 161k — not at the raw extremes, which
 * makes every chart look like a cliff regardless of the actual movement.
 */
export function niceScale(lo: number, hi: number, targetTicks = 4): {
  min: number; max: number; ticks: number[]
} {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 1, ticks: [0, 1] }
  if (lo === hi) {
    const pad = Math.abs(lo) * 0.01 || 1
    lo -= pad; hi += pad
  }
  const span = hi - lo
  const rawStep = span / targetTicks
  const mag = 10 ** Math.floor(Math.log10(rawStep))
  const norm = rawStep / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag

  const min = Math.floor(lo / step) * step
  const max = Math.ceil(hi / step) * step
  const ticks: number[] = []
  // Float arithmetic on the accumulator drifts; derive each tick from an index.
  const n = Math.round((max - min) / step)
  for (let i = 0; i <= n; i++) ticks.push(Number((min + i * step).toPrecision(12)))
  return { min, max, ticks }
}

/**
 * Reduce a dense series to one point per period, so an annual chart of daily
 * data draws 12 points rather than 365 overlapping ones.
 */
export function resample(points: Point[], period: 'week' | 'month' | 'year'): Point[] {
  const buckets = new Map<string, { sum: number; n: number; date: string }>()
  for (const p of points) {
    const key = bucketKey(p.date, period)
    const b = buckets.get(key)
    if (b) { b.sum += p.value; b.n++; b.date = p.date }
    else buckets.set(key, { sum: p.value, n: 1, date: p.date })
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, b]) => ({ date: b.date, value: b.sum / b.n }))
}

function bucketKey(iso: string, period: 'week' | 'month' | 'year'): string {
  if (period === 'year') return iso.slice(0, 4)
  if (period === 'month') return iso.slice(0, 7)
  const d = new Date(`${iso}T00:00:00Z`)
  // ISO-ish week key: the Monday that starts this date's week.
  const day = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - day)
  return d.toISOString().slice(0, 10)
}
