import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params

  try {
    const project = await prisma.project.findFirst({
      where: { slug, status: 'active' },
      orderBy: { updatedAt: 'desc' },
      select: { name: true, latestScores: true, healthData: true },
    })

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

function generateSvgBadge(label: string, value: string, color: string): string {
  const labelWidth = Math.max(50, label.length * 7 + 14)
  const valueWidth = Math.max(42, value.length * 7 + 14)
  const totalWidth = labelWidth + valueWidth

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="${label}: ${value}">
  <title>${label}: ${value}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#1e293b"/>
    <rect x="${labelWidth}" width="${valueWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="110">
    <text aria-hidden="true" x="${(labelWidth * 10) / 2}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(labelWidth - 14) * 10}">${label}</text>
    <text x="${(labelWidth * 10) / 2}" y="140" transform="scale(.1)" fill="#fff" textLength="${(labelWidth - 14) * 10}">${label}</text>
    <text aria-hidden="true" x="${labelWidth * 10 + (valueWidth * 10) / 2}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${(valueWidth - 14) * 10}">${value}</text>
    <text x="${labelWidth * 10 + (valueWidth * 10) / 2}" y="140" transform="scale(.1)" fill="#fff" textLength="${(valueWidth - 14) * 10}">${value}</text>
  </g>
</svg>`
}
