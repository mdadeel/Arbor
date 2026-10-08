import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { requireAccessibleProject } from '@/server/services/project-access'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; analysisId: string }> }
) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id
  if (!userId) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  const { slug, analysisId } = await params

  try {
    const project = await requireAccessibleProject(userId, slug)
    const analysis = await prisma.analysis.findFirst({
      where: { id: analysisId, projectId: project.id, status: 'completed' },
      select: { sbom: true },
    })
    if (!analysis?.sbom) return NextResponse.json({ error: 'SBOM not found for this completed analysis.' }, { status: 404 })
    const filename = `${project.slug.replace(/[^A-Za-z0-9_-]/g, '-')}-sbom.cdx.json`
    return new NextResponse(JSON.stringify(analysis.sbom), {
      headers: {
        'Content-Type': 'application/vnd.cyclonedx+json; version=1.5',
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Could not load the SBOM.' }, { status: 500 })
  }
}
