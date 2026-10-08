import { TRPCError } from '@trpc/server'
import { prisma } from '@/lib/prisma'
import { POLICY_PACKS, type PolicyPackKey, type PolicyPackSetting } from '@/server/analysis/policies'
import { logAuditEvent } from './audit'
import { requireAccessibleProject, requireProjectEditor } from './project-access'
import { requireWorkspaceMembership } from './authorization'

function bumpPatchVersion(version: string) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/)
  if (!match) return '1.0.1'
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`
}

export async function getProjectPolicyState(userId: string, slug: string) {
  const project = await requireAccessibleProject(userId, slug)
  const settings = await prisma.policyPackSetting.findMany({
    where: {
      OR: [
        { projectId: project.id },
        ...(project.workspaceId ? [{ workspaceId: project.workspaceId }] : []),
      ],
    },
  })
  const workspaceSettings = new Map(settings.filter((setting) => setting.workspaceId).map((setting) => [setting.packKey, setting]))
  const projectSettings = new Map(settings.filter((setting) => setting.projectId).map((setting) => [setting.packKey, setting]))

  return POLICY_PACKS.map((pack) => {
    const workspaceSetting = workspaceSettings.get(pack.key) ?? null
    const projectSetting = projectSettings.get(pack.key) ?? null
    const effective: { packKey: string; version: string; enabled: boolean; overrides: unknown } =
      projectSetting ?? workspaceSetting ?? {
        packKey: pack.key,
        version: pack.version,
        enabled: true,
        overrides: {},
      }
    return {
      ...pack,
      workspaceAvailable: Boolean(project.workspaceId),
      workspaceSetting,
      projectSetting,
      effective,
    }
  })
}

export async function getEffectiveProjectPolicySettings(projectId: string, workspaceId: string | null) {
  const settings = await prisma.policyPackSetting.findMany({
    where: {
      OR: [
        { projectId },
        ...(workspaceId ? [{ workspaceId }] : []),
      ],
    },
  })
  return settings
    .filter((setting) => setting.workspaceId)
    .concat(settings.filter((setting) => setting.projectId)) as PolicyPackSetting[]
}

export async function updatePolicyPack(input: {
  userId: string
  slug: string
  packKey: PolicyPackKey
  scope: 'project' | 'workspace'
  enabled: boolean
  overrides: Record<string, { enabled?: boolean; severity?: 'info' | 'warning' | 'critical' }>
}) {
  const project = await requireAccessibleProject(input.userId, input.slug)
  if (input.scope === 'workspace') {
    if (!project.workspaceId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'This project is not assigned to a workspace.' })
    await requireWorkspaceMembership(input.userId, project.workspaceId, ['owner', 'admin'])
  } else {
    await requireProjectEditor(input.userId, project)
  }

  const pack = POLICY_PACKS.find((candidate) => candidate.key === input.packKey)
  if (!pack) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unknown policy pack.' })
  const where = input.scope === 'project'
    ? { projectId: project.id, packKey: input.packKey }
    : { workspaceId: project.workspaceId, packKey: input.packKey }
  const existing = await prisma.policyPackSetting.findFirst({ where })
  const version = existing ? bumpPatchVersion(existing.version) : pack.version
  const data = {
    packKey: pack.key,
    version,
    enabled: input.enabled,
    overrides: input.overrides as unknown as object,
    updatedById: input.userId,
    ...(input.scope === 'project'
      ? { projectId: project.id, workspaceId: null }
      : { projectId: null, workspaceId: project.workspaceId }),
  }

  const setting = existing
    ? await prisma.policyPackSetting.update({ where: { id: existing.id }, data })
    : await prisma.policyPackSetting.create({ data })

  await logAuditEvent({
    userId: input.userId,
    workspaceId: input.scope === 'workspace' ? project.workspaceId : undefined,
    projectId: input.scope === 'project' ? project.id : undefined,
    action: 'policy_pack.updated',
    entityType: 'policy_pack',
    entityId: setting.id,
    metadata: { packKey: pack.key, version, scope: input.scope, enabled: input.enabled },
  })
  return setting
}
