import { NextResponse } from 'next/server'
import { getSharedReport } from '@/server/services/report-sharing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const report = await getSharedReport(token)
  if (!report) {
    return NextResponse.json({ error: 'This report link is invalid, expired, or revoked.' }, {
      status: 404,
      headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
    })
  }
  return NextResponse.json(report, {
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  })
}
