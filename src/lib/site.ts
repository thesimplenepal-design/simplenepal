const FALLBACK = 'http://localhost:3000'

function resolve(): string {
  const raw = (process.env.NEXT_PUBLIC_SITE_URL ?? '').trim()
  if (!raw) return FALLBACK
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    return new URL(candidate).origin
  } catch {
    return FALLBACK
  }
}

export const SITE_URL = resolve()

export function abs(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}
