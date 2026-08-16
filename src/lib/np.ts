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

// ─────────────────────────────────────── Latin → Devanagari
//
// For the address card: a visitor types where they are staying, and a driver
// needs to be able to read it.
//
// Naive letter-by-letter transliteration is not good enough here, and the
// failure is not just cosmetic — "Patan" transliterates to पतन, which is a real
// Nepali word meaning downfall. Handing a driver a card that says "please take
// me to Downfall" is the opposite of the confidence this is supposed to give.
//
// So: a dictionary of the places visitors actually name, checked and correct,
// with a sound-based fallback for everything else — and the caller is told which
// it got, so the page can be honest about the difference.

const PLACE_NE: Record<string, string> = {
  // Kathmandu
  thamel: 'ठमेल', kathmandu: 'काठमाडौं', ktm: 'काठमाडौं', basantapur: 'बसन्तपुर',
  durbar: 'दरबार', square: 'स्क्वायर', 'durbar square': 'दरबार स्क्वायर',
  boudha: 'बौद्ध', bouddha: 'बौद्ध', boudhanath: 'बौद्धनाथ',
  swayambhu: 'स्वयम्भू', swoyambhu: 'स्वयम्भू', pashupati: 'पशुपति',
  pashupatinath: 'पशुपतिनाथ', chhetrapati: 'क्षेत्रपाती', jhamsikhel: 'झम्सिखेल',
  jhochhen: 'झोछेँ', asan: 'असन', indrachowk: 'इन्द्रचोक', ratnapark: 'रत्नपार्क',
  baneshwor: 'बानेश्वर', koteshwor: 'कोटेश्वर', balaju: 'बालाजु', gongabu: 'गोंगबु',
  kalanki: 'कलंकी', chabahil: 'चाबहिल', maharajgunj: 'महाराजगञ्ज',
  lazimpat: 'लाजिम्पाट', naxal: 'नक्साल', sanepa: 'सानेपा', kupondole: 'कुपण्डोल',
  jawalakhel: 'जावलाखेल', pulchowk: 'पुल्चोक', ekantakuna: 'एकान्तकुना',
  budhanilkantha: 'बुढानीलकण्ठ', kirtipur: 'कीर्तिपुर', tribhuvan: 'त्रिभुवन',
  // Valley towns
  patan: 'पाटन', lalitpur: 'ललितपुर', bhaktapur: 'भक्तपुर', madhyapur: 'मध्यपुर',
  thimi: 'थिमी', nagarkot: 'नगरकोट', dhulikhel: 'धुलिखेल', banepa: 'बनेपा',
  // Elsewhere
  pokhara: 'पोखरा', lakeside: 'लेकसाइड', sarangkot: 'सारंगकोट', chitwan: 'चितवन',
  sauraha: 'सौराहा', bharatpur: 'भरतपुर', lumbini: 'लुम्बिनी', janakpur: 'जनकपुर',
  biratnagar: 'विराटनगर', birgunj: 'वीरगन्ज', dharan: 'धरान', butwal: 'बुटवल',
  nepalgunj: 'नेपालगन्ज', dhangadhi: 'धनगढी', rajbiraj: 'राजविराज', jhapa: 'झापा',
  bhairahawa: 'भैरहवा', namche: 'नाम्चे', lukla: 'लुक्ला', besisahar: 'बेसीशहर',
  // Words that turn up in a hotel name
  hotel: 'होटल', guest: 'गेस्ट', house: 'हाउस', 'guest house': 'गेस्ट हाउस',
  guesthouse: 'गेस्टहाउस', lodge: 'लज', resort: 'रिसोर्ट', homestay: 'होमस्टे',
  hostel: 'हस्टल', inn: 'इन', marg: 'मार्ग', tole: 'टोल', chowk: 'चोक',
  road: 'रोड', street: 'स्ट्रिट', ward: 'वडा',
}

const CONSONANTS: [string, string][] = [
  ['chh', 'छ'], ['shr', 'श्र'], ['gy', 'ज्ञ'],
  ['kh', 'ख'], ['gh', 'घ'], ['ch', 'च'], ['jh', 'झ'], ['th', 'थ'], ['dh', 'ध'],
  ['ph', 'फ'], ['bh', 'भ'], ['sh', 'श'], ['ng', 'ङ'], ['ny', 'ञ'],
  ['k', 'क'], ['g', 'ग'], ['j', 'ज'], ['t', 'त'], ['d', 'द'], ['n', 'न'],
  ['p', 'प'], ['b', 'ब'], ['m', 'म'], ['y', 'य'], ['r', 'र'], ['l', 'ल'],
  ['v', 'भ'], ['w', 'व'], ['s', 'स'], ['h', 'ह'], ['f', 'फ'], ['z', 'ज'],
  ['c', 'क'], ['q', 'क'], ['x', 'क्स'],
]

// [latin, independent vowel, matra]
const VOWELS: [string, string, string][] = [
  ['aa', 'आ', 'ा'], ['ai', 'ऐ', 'ै'], ['au', 'औ', 'ौ'], ['ou', 'औ', 'ौ'],
  ['ee', 'ई', 'ी'], ['ii', 'ई', 'ी'], ['oo', 'ऊ', 'ू'], ['uu', 'ऊ', 'ू'],
  ['a', 'अ', ''], ['i', 'इ', 'ि'], ['u', 'उ', 'ु'], ['e', 'ए', 'े'], ['o', 'ओ', 'ो'],
]

function wordToDevanagari(word: string): string {
  const w = word.toLowerCase()
  let out = ''
  let i = 0

  while (i < w.length) {
    const rest = w.slice(i)

    const cons = CONSONANTS.find(([lat]) => rest.startsWith(lat))
    if (cons) {
      i += cons[0].length
      const after = w.slice(i)
      const vow = VOWELS.find(([lat]) => after.startsWith(lat))
      if (vow) {
        i += vow[0].length
        // A written final 'a' is आकार, not the inherent schwa Nepali drops:
        // "Pokhara" is पोखरा, not पोखर.
        const isFinalA = vow[0] === 'a' && i >= w.length
        out += cons[1] + (isFinalA ? 'ा' : vow[2])
      } else {
        // Consonant with no vowel: halanta mid-word, bare at the end (Nepali
        // deletes the final schwa anyway, so ठमेल not ठमेल्).
        out += cons[1] + (i >= w.length ? '' : '्')
      }
      continue
    }

    const vow = VOWELS.find(([lat]) => rest.startsWith(lat))
    if (vow) { i += vow[0].length; out += vow[1]; continue }

    out += rest[0] === ' ' ? ' ' : rest[0]
    i++
  }
  return out
}

export type DevanagariResult = { text: string; exact: boolean }

/**
 * Latin → Devanagari for an address.
 * `exact` is true only when every word came from the checked dictionary.
 */
export function toDevanagari(input: string): DevanagariResult {
  const raw = (input ?? '').trim()
  if (!raw) return { text: '', exact: true }

  const lower = raw.toLowerCase()
  if (PLACE_NE[lower]) return { text: PLACE_NE[lower], exact: true }

  let allKnown = true
  const parts = raw.split(/([,\s]+)/).map((tok) => {
    if (/^[,\s]+$/.test(tok)) return tok
    const key = tok.toLowerCase().replace(/[^a-z]/g, '')
    if (PLACE_NE[key]) return PLACE_NE[key]
    if (/^\d+$/.test(tok)) return tok.replace(/[0-9]/g, (d) => '०१२३४५६७८९'[Number(d)])
    allKnown = false
    return wordToDevanagari(tok)
  })

  return { text: parts.join('').replace(/\s+/g, ' ').trim(), exact: allKnown }
}
