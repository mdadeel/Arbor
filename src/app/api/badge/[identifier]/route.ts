import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const BADGE_SELECT = { name: true, latestScores: true, healthData: true } as const

/**
 * Resolves a badge identifier to a public, active project.
 *
 * - A project ID (globally unique) is preferred; the README snippet uses it.
 * - A slug is only accepted when it matches exactly one public project. Slugs are
 *   unique per user, not globally, so an ambiguous slug is treated as not found
 *   rather than guessing which user's project is meant.
 * - Private repositories are never exposed, because badge images are fetched
 *   by GitHub's image proxy from the public internet.
 */
async function findPublicBadgeProject(identifier: string) {
  const byId = await prisma.project.findFirst({
    where: { id: identifier, status: 'active', repoPrivate: false },
    select: BADGE_SELECT,
  })
  if (byId) return byId

  const bySlug = await prisma.project.findMany({
    where: { slug: identifier, status: 'active', repoPrivate: false },
    select: BADGE_SELECT,
    take: 2,
  })
  return bySlug.length === 1 ? bySlug[0] : null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ identifier: string }> }
) {
  const { identifier } = await params

  try {
    const project = await findPublicBadgeProject(identifier)

    if (!project) {
      return new NextResponse(generateSvgBadge('Arbor', 'not found', '#6b7280'), {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      })
    }

    const scores = project.latestScores as { overall?: number | null } | null
    const health = project.healthData as { score?: number | null } | null
    const score = scores?.overall ?? health?.score

    if (score == null) {
      return new NextResponse(generateSvgBadge('Arbor', 'unscored', '#64748b'), {
        headers: {
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=60',
        },
      })
    }

    let color = '#ef4444' // Red (< 60)
    if (score >= 80) color = '#10b981' // Green
    else if (score >= 60) color = '#f59e0b' // Amber

    const text = `${score}/100`
    return new NextResponse(generateSvgBadge('Arbor Audit', text, color), {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=120',
      },
    })
  } catch {
    return new NextResponse(generateSvgBadge('Arbor', 'error', '#ef4444'), {
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'no-cache',
      },
    })
  }
}

function escapeXml(str: string): string {
  return str.replace(/[<>&"']/g, (c) => {
    switch (c) {
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '&':
        return '&amp;'
      case '"':
        return '&quot;'
      case "'":
        return '&apos;'
      default:
        return c
    }
  })
}

function generateSvgBadge(label: string, value: string, color: string): string {
  const safeLabel = escapeXml(label)
  const safeValue = escapeXml(value)
  const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#6b7280'

  const labelWidth = Math.max(50, label.length * 7 + 14)
  const valueWidth = Math.max(42, value.length * 7 + 14)
  const totalWidth = labelWidth + valueWidth

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${safeLabel}: ${safeValue}">
  <title>${safeLabel}: ${safeValue}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#1e293b"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${safeColor}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="${(labelWidth * 10) / 2}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(labelWidth - 14) * 10}">${safeLabel}</text>
    <text x="${(labelWidth * 10) / 2}" y="140" transform="scale(.1)" fill="#fff" textLength="${(labelWidth - 14) * 10}">${safeLabel}</text>
    <text aria-hidden="true" x="${labelWidth * 10 + (valueWidth * 10) / 2}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(valueWidth - 14) * 10}">${safeValue}</text>
    <text x="${labelWidth * 10 + (valueWidth * 10) / 2}" y="140" transform="scale(.1)" fill="#fff" textLength="${(valueWidth - 14) * 10}">${safeValue}</text>
  </g>
</svg>`
}
