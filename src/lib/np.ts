/**
 * Nepali text handling. This is not a nicety — it decides whether search finds
 * things and whether dedup works.
 *
 * The same restaurant may be typed as any of:
 *   "Bajeko Sekuwa" · "bajeko sekuwa" · "Bajeko Sekuwa Pvt. Ltd." · "बजेको सेकुवा"
 * All four must resolve to one record.
 */

// ─────────────────────────────────────────── Devanagari tables

/** Consonants carry an inherent 'a' unless a matra or halant follows. */
const CONSONANT: Record<string, string> = {
  'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'ng',
  'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'ny',
  'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
  'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
  'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
  'य': 'y', 'र': 'r', 'ल': 'l', 'व': 'w', 'श': 'sh',
  'ष': 'sh', 'स': 's', 'ह': 'h',
  'क्ष': 'chh', 'त्र': 'tr', 'ज्ञ': 'gy', 'श्र': 'shr',
  'ऱ': 'r', 'ऴ': 'l',
}

/** Matras replace the inherent vowel. */
const MATRA: Record<string, string> = {
  'ा': 'a', 'ि': 'i', 'ी': 'i', 'ु': 'u', 'ू': 'u',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  'ृ': 'ri', 'ॅ': 'e', 'ॉ': 'o',
}

/** Independent vowels stand alone. */
const VOWEL: Record<string, string> = {
  'अ': 'a', 'आ': 'a', 'इ': 'i', 'ई': 'i', 'उ': 'u', 'ऊ': 'u',
  'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au', 'ऋ': 'ri', 'ॠ': 'ri',
}

const HALANT = '्'
const NASAL = new Set(['ं', 'ँ'])
const DROP = new Set(['ः', 'ऽ', '़', '‍', '‌'])

const DEVA_DIGIT: Record<string, string> = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9',
}

export function devanagariDigitsToLatin(s: string): string {
  return s.replace(/[०-९]/g, (d) => DEVA_DIGIT[d] ?? d)
}

/**
 * Devanagari → Latin with correct inherent-vowel (schwa) handling.
 *
 * A naive lookup table gives "बजेको" → "bjek". The inherent 'a' after every
 * bare consonant is why: ब is "ba", not "b". We also apply word-final schwa
 * deletion, which is what makes "सेकुवा" come out as "sekuwa" rather than
 * "sekuwaa".
 *
 * This is approximate — no rule set turns काठमाडौं into exactly "Kathmandu" —
 * but it is close enough for slugs and more than close enough for keys.
 */
export function transliterate(input: string): string {
  const s = devanagariDigitsToLatin(input)
  let out = ''
  let i = 0

  while (i < s.length) {
    const ch = s[i]
    const two = s.slice(i, i + 3) // conjuncts like क्ष are 3 code units

    if (CONSONANT[two] !== undefined) {
      out += emitConsonant(CONSONANT[two], s, i + 3)
      i += 3
      continue
    }
    if (CONSONANT[ch] !== undefined) {
      out += emitConsonant(CONSONANT[ch], s, i + 1)
      i += 1
      continue
    }
    if (VOWEL[ch] !== undefined) { out += VOWEL[ch]; i++; continue }
    if (MATRA[ch] !== undefined) { out += MATRA[ch]; i++; continue }
    if (ch === HALANT) { i++; continue }
    if (NASAL.has(ch)) { out += 'n'; i++; continue }
    if (DROP.has(ch)) { i++; continue }

    out += ch
    i++
  }
  return out
}

/** Decide what vowel (if any) follows a consonant at position `next`. */
function emitConsonant(latin: string, s: string, next: number): string {
  const nx = s[next]
  if (nx === HALANT) return latin                 // conjunct — no vowel
  if (nx !== undefined && MATRA[nx] !== undefined) return latin // matra supplies it
  // Word-final schwa deletion: Nepali drops the trailing inherent 'a'.
  const atEnd = nx === undefined || /[\s।॥.,;:!?()-]/.test(nx)
  return atEnd ? latin : latin + 'a'
}

/** URL slug. Handles Devanagari input by transliterating first. */
export function slugify(input: string): string {
  return transliterate(input)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

// ─────────────────────────────────────────────────── dedup key

/** Noise words that carry no identifying signal in a Nepali business name. */
const STOP = new Set([
  'pvt', 'pvtltd', 'ltd', 'limited', 'private', 'company', 'co', 'and', 'the',
  'nepal', 'inc', 'llc', 'enterprises', 'enterprise', 'suppliers', 'udhyog',
  'store', 'stores', 'shop', 'center', 'centre', 'pratisthan', 'sewa',
])

/**
 * The key used for dedup and fuzzy matching.
 *
 * Romanised Nepali is vowel-unstable — Bajeko/Bajeco/Bajaiko, Thakali/Thakaali —
 * while consonants are comparatively reliable. So the key is a consonant
 * skeleton with sound-alike consonants folded together. Two records sharing a
 * key *in the same local level* are treated as probably the same place.
 *
 * Deliberately lossy, and therefore deliberately advisory: the capture flow
 * warns and offers "save anyway" rather than hard-blocking, because Nepal
 * genuinely has three Hotel Namastes in one municipality.
 */
export function nameKey(input: string): string {
  const latin = transliterate(input)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const tokens = latin
    .split(' ')
    // Stopwords are removed on the RAW token, before any folding — otherwise
    // "pvt" folds to "pbt" (v→b) and stops matching the stop list.
    .filter((t) => t.length > 1 && !STOP.has(t))
    .map(skeleton)
    .filter(Boolean)

  return tokens.sort().join('-')
}

/**
 * Consonant skeleton: fold sound-alikes, drop vowels, collapse doubles.
 * Short words keep one vowel so "Om" and "Am" do not collide into nothing.
 */
function skeleton(t: string): string {
  const folded = t
    .replace(/tch/g, 'ch')
    .replace(/ch/g, '')   // park 'ch' so the c→k fold below can't eat it
    .replace(/ph/g, 'f')
    .replace(/sh/g, 's')
    .replace(/ck/g, 'k')
    .replace(/c/g, 'k')         // Cafe / Kafe, Cumari / Kumari
    .replace(//g, 'ch')
    .replace(/[vw]/g, 'b')
    .replace(/z/g, 'j')
    .replace(/y/g, 'i')
    .replace(/(.)\1+/g, '$1')

  const consonants = folded.replace(/[aeiou]/g, '')
  // Fall back to the folded form for vowel-heavy short words ("aama", "eoi").
  return consonants.length >= 2 ? consonants : folded
}

/** Cheap geohash for proximity bucketing before PostGIS lands. */
export function geohash(lat: number, lng: number, precision = 5): string {
  const B32 = '0123456789bcdefghjkmnpqrstuvwxyz'
  const latR = [-90, 90]
  const lngR = [-180, 180]
  let hash = ''
  let bits = 0
  let bit = 0
  let even = true
  while (hash.length < precision) {
    if (even) {
      const mid = (lngR[0] + lngR[1]) / 2
      if (lng > mid) { bits = (bits << 1) + 1; lngR[0] = mid } else { bits <<= 1; lngR[1] = mid }
    } else {
      const mid = (latR[0] + latR[1]) / 2
      if (lat > mid) { bits = (bits << 1) + 1; latR[0] = mid } else { bits <<= 1; latR[1] = mid }
    }
    even = !even
    if (++bit === 5) { hash += B32[bits]; bits = 0; bit = 0 }
  }
  return hash
}
