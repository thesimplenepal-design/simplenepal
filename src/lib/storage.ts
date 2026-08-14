import { put } from '@vercel/blob'
import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Photo storage.
 *
 * Vercel's filesystem is ephemeral — anything written to `public/` during a
 * request is gone at the next deploy or cold start. So on Vercel we write to
 * Blob; locally we write to disk so `npm run dev` needs no accounts or tokens.
 *
 * Vercel Blob rather than Cloudflare R2 on purpose: R2 is the better long-term
 * home (zero egress, cheaper at volume) but it needs a new account today, and
 * right now the binding constraint is your field time, not storage economics.
 * Swap `putPhoto` for an S3 client when photo volume actually justifies it —
 * everything else in the codebase only knows about the returned URL.
 */
export async function putPhoto(dataUrl: string, name: string): Promise<string | null> {
  const m = /^data:image\/(\w+);base64,(.+)$/.exec(dataUrl ?? '')
  if (!m) return null

  const bytes = Buffer.from(m[2], 'base64')
  const filename = `${name}.jpg`

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const { url } = await put(`places/${filename}`, bytes, {
      access: 'public',
      contentType: 'image/jpeg',
      // Field photos are immutable evidence; never overwrite one silently.
      addRandomSuffix: true,
      cacheControlMaxAge: 31_536_000,
    })
    return url
  }

  const dir = join(process.cwd(), 'public', 'u')
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, filename), bytes)
  return `/u/${filename}`
}
