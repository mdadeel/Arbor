import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  projectAccess: vi.fn(), projectEditor: vi.fn(), groupAccess: vi.fn(), workspaceAccess: vi.fn(),
  deliver: vi.fn(), health: vi.fn(), rate: vi.fn(), quota: vi.fn(),
  analysis: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  system: { findFirst: vi.fn() },
}))
vi.mock('@/server/trpc', async () => {
  const { initTRPC } = await import('@trpc/server')
  const t = initTRPC.create()
  return { router: t.router, protectedProcedure: t.procedure }
})
vi.mock('@/lib/prisma', () => ({ prisma: {
  analysis: m.analysis, systemAnalysis: m.system,
  $transaction: async (fn: (tx: { analysis: typeof m.analysis }) => unknown) => fn({ analysis: m.analysis }),
} }))
vi.mock('@/lib/redis', () => ({ checkRateLimit: m.rate }))
vi.mock('@/server/services/project-access', () => ({ requireAccessibleProject: m.projectAccess, requireProjectEditor: m.projectEditor }))
vi.mock('@/server/services/system-group', () => ({ getGroupBySlug: m.groupAccess, listGroups: vi.fn(), createGroup: vi.fn(), deleteGroup: vi.fn(), enqueueSystemAnalysis: vi.fn() }))
vi.mock('@/server/services/authorization', () => ({ requireWorkspaceMembership: m.workspaceAccess, WORKSPACE_PROJECT_ROLES: ['owner', 'admin', 'member'] }))
vi.mock('@/server/services/project', () => ({ createProject: vi.fn(), listProjects: vi.fn(), getProjectBySlug: vi.fn(), slugify: (slug: string) => slug }))
vi.mock('@/server/services/analysis-dispatch', () => ({ deliverQueuedAnalysis: m.deliver, getProcessingHealth: m.health, QUEUE_DELIVERY_ERROR: 'Queue unavailable; scan saved.' }))
vi.mock('@/server/services/quotas', () => ({ consumeAnalysisQuota: m.quota }))
vi.mock('@/server/services/audit', () => ({ logAuditEvent: async () => {} }))
vi.mock('@/server/services/commits', () => ({ getProjectCommits: vi.fn() }))
vi.mock('@/server/services/finding-context', () => ({ getFindingCodeContext: vi.fn() }))

import { TRPCError } from '@trpc/server'
import { projectRouter } from './project'
import { systemRouter } from './system'

const project = projectRouter.createCaller({ session: { user: { id: 'user' } } } as never)
const system = systemRouter.createCaller({ session: { user: { id: 'user' } } } as never)
const input = { slug: 'demo', analysisId: 'scan' }

describe('analysis delivery endpoints', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    m.projectAccess.mockResolvedValue({ id: 'project', userId: 'user', workspaceId: null, defaultBranch: 'main' })
    m.groupAccess.mockResolvedValue({ id: 'group', userId: 'user', workspaceId: null })
    m.projectEditor.mockResolvedValue(undefined)
    m.workspaceAccess.mockResolvedValue({ role: 'member' })
    m.analysis.findFirst.mockResolvedValue({ id: 'scan' })
    m.system.findFirst.mockResolvedValue({ id: 'scan' })
    m.deliver.mockResolvedValue(true)
    m.rate.mockResolvedValue({ allowed: true })
    m.health.mockResolvedValue({ queue: 'available', worker: 'not-detected', paused: false })
  })

  it('checks project access before inspecting processing infrastructure', async () => {
    m.projectAccess.mockRejectedValue(new TRPCError({ code: 'NOT_FOUND' }))
    await expect(project.processingHealth({ slug: 'demo' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(m.health).not.toHaveBeenCalled()
  })

  it('allows viewing health without granting a viewer retry access', async () => {
    m.projectEditor.mockRejectedValue(new TRPCError({ code: 'FORBIDDEN' }))
    await expect(project.processingHealth({ slug: 'demo' })).resolves.toMatchObject({ canRetry: false })
    await expect(project.retryQueued(input)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(m.deliver).not.toHaveBeenCalled()
  })

  it('scopes a delivery retry to the accessible project and existing queued scan', async () => {
    await expect(project.retryQueued(input)).resolves.toEqual({ analysisId: 'scan' })
    expect(m.analysis.findFirst).toHaveBeenCalledWith({ where: { id: 'scan', projectId: 'project', status: 'queued' }, select: { id: true } })
    expect(m.deliver).toHaveBeenCalledWith('repository', 'scan')
    expect(m.analysis.create).not.toHaveBeenCalled()
    expect(m.quota).not.toHaveBeenCalled()
  })

  it('does not retry a running scan or a scan belonging to another project', async () => {
    m.analysis.findFirst.mockResolvedValue(null)
    await expect(project.retryQueued(input)).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(m.deliver).not.toHaveBeenCalled()
  })

  it('rate limits repeated repair requests without creating new analyses', async () => {
    m.rate.mockResolvedValue({ allowed: false })
    await expect(project.retryQueued(input)).rejects.toMatchObject({ code: 'TOO_MANY_REQUESTS' })
    expect(m.deliver).not.toHaveBeenCalled()
  })

  it('returns a recoverable inline error when delivery is unavailable', async () => {
    m.deliver.mockResolvedValue(false)
    await expect(project.retryQueued(input)).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE', message: 'Queue unavailable; scan saved.' })
  })

  it('does not mark an old running analysis failed to start a replacement and does not spend quota', async () => {
    m.analysis.findFirst.mockResolvedValue({ id: 'old', status: 'analyzing', createdAt: new Date(0) })
    await expect(project.analyze({ slug: 'demo' })).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(m.analysis.update).not.toHaveBeenCalled()
    expect(m.analysis.create).not.toHaveBeenCalled()
    expect(m.quota).not.toHaveBeenCalled()
  })

  it('fetches an authorized historical completed report for a project', async () => {
    m.analysis.findFirst.mockResolvedValue({
      id: 'history-1',
      status: 'completed',
      overallScore: 88,
      projectId: 'project',
    })
    const report = await project.analysisReport({ slug: 'demo', analysisId: 'history-1' })
    expect(report).toMatchObject({ id: 'history-1', status: 'completed', overallScore: 88 })
    expect(m.analysis.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'history-1', projectId: 'project', status: 'completed' },
      })
    )
  })

  it('rejects access to missing or incomplete historical reports', async () => {
    m.analysis.findFirst.mockResolvedValue(null)
    await expect(project.analysisReport({ slug: 'demo', analysisId: 'missing' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('scopes system repairs to their group without spending another analysis quota', async () => {
    await expect(system.retryQueued(input)).resolves.toEqual({ analysisId: 'scan' })
    expect(m.system.findFirst).toHaveBeenCalledWith({ where: { id: 'scan', groupId: 'group', status: 'queued' }, select: { id: true } })
    expect(m.deliver).toHaveBeenCalledWith('system', 'scan')
    expect(m.quota).not.toHaveBeenCalled()
  })

  it('rejects system analysis for workspace viewers without edit rights', async () => {
    m.groupAccess.mockResolvedValue({ id: 'group', userId: 'other-user', workspaceId: 'workspace' })
    m.workspaceAccess.mockRejectedValue(new TRPCError({ code: 'FORBIDDEN' }))
    await expect(system.analyze({ slug: 'demo' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(m.quota).not.toHaveBeenCalled()
  })

  it('redelivers an existing pending system analysis without consuming additional quota', async () => {
    m.system.findFirst.mockResolvedValue({ id: 'existing-sys', status: 'queued' })
    const result = await system.analyze({ slug: 'demo' })
    expect(result).toMatchObject({ id: 'existing-sys', status: 'queued' })
    expect(m.deliver).toHaveBeenCalledWith('system', 'existing-sys')
    expect(m.quota).not.toHaveBeenCalled()
  })

  it('rejects a system viewer even if they originally created the workspace group', async () => {
    m.groupAccess.mockResolvedValue({ id: 'group', userId: 'user', workspaceId: 'workspace' })
    m.workspaceAccess.mockRejectedValue(new TRPCError({ code: 'FORBIDDEN' }))
    await expect(system.processingHealth({ slug: 'demo' })).resolves.toMatchObject({ canRetry: false })
    await expect(system.retryQueued(input)).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(m.deliver).not.toHaveBeenCalled()
  })

  it('rejects access to a missing or inaccessible system', async () => {
    m.groupAccess.mockResolvedValue(null)
    await expect(system.retryQueued(input)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(m.deliver).not.toHaveBeenCalled()
  })
})
