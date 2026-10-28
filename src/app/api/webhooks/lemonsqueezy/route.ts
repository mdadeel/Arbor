import { NextResponse } from 'next/server'
import { ingestLemonSqueezyWebhook } from '@/server/services/billing'

export const runtime = 'nodejs'

const MAX_WEBHOOK_BYTES = 256 * 1024

async function readBodyLimited(
  req: Request,
  maxBytes: number
): Promise<{ ok: true; text: string } | { ok: false; status: number }> {
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, status: 413 }
  }
  if (!req.body) return { ok: true, text: '' }

  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      return { ok: false, status: 413 }
    }
    chunks.push(value)
  }

  return { ok: true, text: Buffer.concat(chunks).toString('utf8') }
}

export async function POST(req: Request) {
  const body = await readBodyLimited(req, MAX_WEBHOOK_BYTES)
  if (!body.ok) {
    return NextResponse.json(
      { accepted: false, reason: 'Webhook payload exceeds size limit.' },
      { status: body.status }
    )
  }

  try {
    const result = await ingestLemonSqueezyWebhook({
      rawBody: body.text,
      signatureHeader: req.headers.get('x-signature'),
      eventIdHeader: req.headers.get('x-event-id'),
    })
    return NextResponse.json(result.body, { status: result.httpStatus })
  } catch {
    return NextResponse.json(
      { accepted: false, reason: 'Internal billing webhook error.' },
      { status: 500 }
    )
  }
}
