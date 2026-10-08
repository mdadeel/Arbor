import { createHash } from 'node:crypto'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/redis'

const MAX_BODY_BYTES = 8 * 1024

const waitlistSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(254),
  source: z.string().trim().max(128).optional().default('pricing_pro'),
})

function fingerprint(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

async function readBoundedBody(req: Request, maxBytes: number): Promise<string> {
  if (!req.body) return ''
  const reader = req.body.getReader()
  const chunks: Buffer[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.byteLength
    if (totalBytes > maxBytes) {
      await reader.cancel()
      throw new RangeError('Request body is too large')
    }
    chunks.push(Buffer.from(value))
  }

  return Buffer.concat(chunks, totalBytes).toString('utf8')
}

export async function POST(req: Request) {
  const contentLength = Number(req.headers.get('content-length') ?? 0)
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body is too large.' }, { status: 413 })
  }

  let rawBody: string
  try {
    rawBody = await readBoundedBody(req, MAX_BODY_BYTES)
  } catch (error) {
    if (error instanceof RangeError) {
      return NextResponse.json({ error: 'Request body is too large.' }, { status: 413 })
    }
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  let json: unknown
  try {
    json = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 })
  }

  const parsed = waitlistSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Please provide a valid email address.' }, { status: 400 })
  }

  const { email, source } = parsed.data
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const clientIp = req.headers.get('x-real-ip')?.trim() || forwardedFor || 'unknown'

  const [ipLimit, emailLimit] = await Promise.all([
    checkRateLimit(`rate:waitlist:ip:${fingerprint(clientIp)}`, 5, 3600),
    checkRateLimit(`rate:waitlist:email:${fingerprint(email.toLowerCase())}`, 3, 86400),
  ])
  if (!ipLimit.allowed || !emailLimit.allowed) {
    return NextResponse.json(
      { error: 'Too many waitlist requests. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    const lead = await prisma.waitlistLead.upsert({
      where: { email: email.toLowerCase() },
      update: { source },
      create: {
        email: email.toLowerCase(),
        source,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Successfully registered for early access.',
      lead: { id: lead.id, email: lead.email },
    })
  } catch (error) {
    console.error('Failed to save waitlist lead:', error)
    return NextResponse.json(
      { error: 'Failed to join waitlist. Please try again later.' },
      { status: 500 }
    )
  }
}
