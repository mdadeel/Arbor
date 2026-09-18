import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    waitlistLead: {
      upsert: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { POST } from './route'

describe('Waitlist API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects invalid email address', async () => {
    const req = new NextRequest('http://localhost:3000/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email: 'notanemail' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBeDefined()
  })

  it('successfully creates or upserts valid waitlist email', async () => {
    vi.mocked(prisma.waitlistLead.upsert).mockResolvedValueOnce({
      id: 'lead-123',
      email: 'founder@startup.com',
      source: 'pricing_pro',
      createdAt: new Date(),
    } as any)

    const req = new NextRequest('http://localhost:3000/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email: 'founder@startup.com', source: 'pricing_pro' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.lead.email).toBe('founder@startup.com')
  })
})
