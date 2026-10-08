import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/redis', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 5 }),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    waitlistLead: {
      upsert: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/redis'
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

  it('rejects bodies above the streaming size limit', async () => {
    const req = new NextRequest('http://localhost:3000/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email: 'founder@startup.com', source: 'x'.repeat(9000) }),
    })
    const res = await POST(req)
    expect(res.status).toBe(413)
    expect(prisma.waitlistLead.upsert).not.toHaveBeenCalled()
  })

  it('rate limits repeated waitlist requests', async () => {
    vi.mocked(checkRateLimit).mockResolvedValueOnce({ allowed: false, remaining: 0 })

    const req = new NextRequest('http://localhost:3000/api/waitlist', {
      method: 'POST',
      body: JSON.stringify({ email: 'founder@startup.com' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(429)
    expect(prisma.waitlistLead.upsert).not.toHaveBeenCalled()
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
