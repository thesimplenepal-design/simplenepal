import { NextResponse } from 'next/server'
import { db } from '@/db'
import { leadEvent } from '@/db/schema'

export const runtime = 'nodejs'

const KINDS = new Set([
  'view','phone_reveal','call_click','whatsapp_click',
  'directions_click','website_click','share','search_impression',
])

/** No IP, no cookie, no identifier. Enough to prove value, not to track a person. */
export async function POST(req: Request) {
  try {
    const { orgId, kind, surface } = await req.json()
    if (!Number.isInteger(orgId) || !KINDS.has(kind)) {
      return new NextResponse('bad request', { status: 400 })
    }
    await db.insert(leadEvent).values({
      organisationId: orgId,
      kind,
      surface: typeof surface === 'string' ? surface.slice(0, 32) : null,
      referrer: req.headers.get('referer')?.slice(0, 200) ?? null,
    })
  } catch { /* never surface analytics failures to a user */ }
  return new NextResponse(null, { status: 204 })
}
