import { NextResponse } from 'next/server'
import { db } from '@/db'
import { agency, localLevel, district } from '@/db/schema'
import { and, eq, or, ilike, sql } from 'drizzle-orm'

export const runtime = 'nodejs'

/**
 * Resolve "where I live" → "the office that serves me".
 * v1: the local government office for that local level. Ward-level splits at
 * district offices come later, as we confirm jurisdiction by phone.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  if (q.length < 3) return NextResponse.json([])

  try {
    const rows = await db
      .select({
        slug: agency.slug,
        label: sql<string>`${agency.nameEn} || ', ' || ${district.nameEn} || ' District'`,
      })
      .from(agency)
      .innerJoin(localLevel, eq(localLevel.id, agency.localLevelId))
      .innerJoin(district, eq(district.id, localLevel.districtId))
      .where(and(
        eq(agency.level, 'local'),
        eq(agency.published, true),
        or(ilike(localLevel.nameEn, `%${q}%`), ilike(localLevel.nameNe, `%${q}%`)),
      ))
      .limit(8)
    return NextResponse.json(rows)
  } catch {
    return NextResponse.json([])
  }
}
