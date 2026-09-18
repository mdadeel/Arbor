import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

const waitlistSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  source: z.string().optional().default('pricing_pro'),
})

export async function POST(req: Request) {
  try {
    const json = await req.json()
    const parsed = waitlistSchema.safeParse(json)

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Please provide a valid email address.' },
        { status: 400 }
      )
    }

    const { email, source } = parsed.data

    const lead = await prisma.waitlistLead.upsert({
      where: { email },
      update: { source },
      create: {
        email,
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
