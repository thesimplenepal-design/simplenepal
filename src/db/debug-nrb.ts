/**
 * Print the SHAPE of a live NRB response, so the parser can be matched to what
 * the API actually returns rather than what its documentation says.
 *
 *   npm run debug:nrb
 *
 * Prints keys and types, plus one sample record. Rates are public information,
 * so there is nothing sensitive here — but it prints structure rather than
 * dumping 100 records, so the output stays pasteable.
 */
import 'dotenv/config'

const URL_ = 'https://www.nrb.org.np/api/forex/v1/rates'

function shape(v: unknown, depth = 0): string {
  const pad = '  '.repeat(depth)
  if (v === null) return 'null'
  if (Array.isArray(v)) {
    if (v.length === 0) return 'array(empty)'
    return `array(${v.length}) of:\n${pad}  ${shape(v[0], depth + 1)}`
  }
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    const keys = Object.keys(o)
    if (keys.length === 0) return 'object{}'
    return `object{\n` + keys.map((k) => {
      const val = o[k]
      const t = Array.isArray(val) ? shape(val, depth + 2)
        : val !== null && typeof val === 'object' ? shape(val, depth + 2)
        : `${typeof val} = ${JSON.stringify(val)}`
      return `${pad}    ${k}: ${t}`
    }).join('\n') + `\n${pad}  }`
  }
  return `${typeof v} = ${JSON.stringify(v)}`
}

async function main() {
  const to = new Date().toISOString().slice(0, 10)
  const from = new Date(Date.now() - 10 * 86_400_000).toISOString().slice(0, 10)
  const url = `${URL_}?from=${from}&to=${to}&page=1&per_page=3`

  console.log(`GET ${url}\n`)
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'SimpleNepal/1.0 (+https://simplenepal.com)' },
  })
  console.log(`HTTP ${res.status} ${res.statusText}`)
  console.log(`content-type: ${res.headers.get('content-type')}\n`)

  const text = await res.text()
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    console.log('NOT JSON. First 600 characters:\n')
    console.log(text.slice(0, 600))
    return
  }

  console.log('=== TOP-LEVEL KEYS ===')
  console.log(Object.keys(json as object).join(', '), '\n')

  console.log('=== SHAPE ===')
  console.log(shape(json))

  console.log('\n=== FIRST RECORD, VERBATIM ===')
  const j = json as Record<string, any>
  const firstDay =
    j?.data?.payload?.[0] ?? j?.payload?.[0] ?? j?.data?.[0] ?? j?.rates?.[0] ?? null
  console.log(JSON.stringify(firstDay, null, 2)?.slice(0, 1200) ?? 'could not locate a day record')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
