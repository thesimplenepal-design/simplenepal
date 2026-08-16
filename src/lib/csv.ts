/**
 * A small RFC-4180-ish CSV parser.
 *
 * Lives here rather than inside the import script so it can be tested without
 * running an import — a parser you cannot test in isolation is a parser you
 * find out about in production.
 */

export type Row = Record<string, string>

/** A small RFC-4180-ish parser: quoted fields, embedded commas and newlines. */
export function parseCsv(text: string): Row[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += c
      continue
    }
    if (c === '"') { quoted = true; continue }
    if (c === ',') { row.push(field); field = ''; continue }
    if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue }
    field += c
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row) }

  const [head, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ''))
  if (!head) return []
  const keys = head.map((h) => h.trim().toLowerCase())
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])))
}
