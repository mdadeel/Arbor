import { prisma } from '@/lib/prisma'
import { TRPCError } from '@trpc/server'
import type { EnvVariableStatus, EnvVariableCategory } from '@prisma/client'

const CATEGORIES: EnvVariableCategory[] = [
  'database',
  'api_key',
  'auth',
  'config',
  'storage',
  'other',
]

const DEFAULT_ENVS: { name: string; type: 'development' | 'staging' | 'production' }[] = [
  { name: 'development', type: 'development' },
  { name: 'staging', type: 'staging' },
  { name: 'production', type: 'production' },
]

async function latestSourceEnvVars(projectId: string): Promise<string[]> {
  const analysis = await prisma.analysis.findFirst({
    where: { projectId, status: 'completed' },
    orderBy: { createdAt: 'desc' },
    select: { metrics: true },
  })
  const metrics = analysis?.metrics as { sourceEnvVars?: string[] } | null
  return metrics?.sourceEnvVars ?? []
}

async function requireEnvironment(projectId: string, environmentId: string) {
  const env = await prisma.environment.findFirst({
    where: { id: environmentId, projectId },
    select: { id: true },
  })
  if (!env) throw new TRPCError({ code: 'NOT_FOUND', message: 'Environment not found.' })
}

export type EnvMatrix = {
  environments: {
    id: string
    name: string
    type: string
    url: string | null
  }[]
  variables: {
    id: string
    environmentId: string
    key: string
    status: EnvVariableStatus
    required: boolean
    category: string
    description: string | null
  }[]
}

export async function getMatrix(projectId: string): Promise<EnvMatrix> {
  const environments = await prisma.environment.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, type: true, url: true },
  })
  const variables = await prisma.envVariable.findMany({
    where: { environmentId: { in: environments.map((e) => e.id) } },
    orderBy: { key: 'asc' },
    select: {
      id: true,
      environmentId: true,
      key: true,
      status: true,
      required: true,
      category: true,
      description: true,
    },
  })
  return { environments, variables }
}

/**
 * Auto-creates development/staging/production environments and one variable
 * row per detected source env var. No-op when environments already exist.
 */
export async function setupEnvironments(projectId: string): Promise<EnvMatrix> {
  const existing = await prisma.environment.findFirst({ where: { projectId } })
  if (existing) return getMatrix(projectId)

  const keys = await latestSourceEnvVars(projectId)
  await prisma.$transaction(
    DEFAULT_ENVS.map((env) =>
      prisma.environment.create({
        data: {
          projectId,
          name: env.name,
          type: env.type,
          variables: {
            create: keys.map((key) => ({ key })),
          },
        },
      })
    )
  )
  return getMatrix(projectId)
}

export async function updateVariableStatus(
  projectId: string,
  variableId: string,
  status: EnvVariableStatus
) {
  const variable = await prisma.envVariable.findUnique({
    where: { id: variableId },
    select: { environmentId: true },
  })
  if (!variable) throw new TRPCError({ code: 'NOT_FOUND', message: 'Variable not found.' })
  await requireEnvironment(projectId, variable.environmentId)
  return prisma.envVariable.update({ where: { id: variableId }, data: { status } })
}

export async function createVariable(
  projectId: string,
  environmentId: string,
  key: string,
  data: { required?: boolean; category?: string; description?: string } = {}
) {
  await requireEnvironment(projectId, environmentId)
  const existing = await prisma.envVariable.findUnique({
    where: { environmentId_key: { environmentId, key } },
    select: { id: true },
  })
  if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'Variable already exists.' })
  return prisma.envVariable.create({
    data: {
      environmentId,
      key,
      required: data.required ?? true,
      category: CATEGORIES.includes(data.category as EnvVariableCategory)
        ? (data.category as EnvVariableCategory)
        : 'other',
      description: data.description,
    },
  })
}

export async function deleteVariable(projectId: string, variableId: string) {
  const variable = await prisma.envVariable.findUnique({
    where: { id: variableId },
    select: { environmentId: true },
  })
  if (!variable) throw new TRPCError({ code: 'NOT_FOUND', message: 'Variable not found.' })
  await requireEnvironment(projectId, variable.environmentId)
  await prisma.envVariable.delete({ where: { id: variableId } })
}

export async function generateEnvTemplate(projectId: string): Promise<string> {
  const { environments, variables } = await getMatrix(projectId)
  const devEnv = environments.find((e) => e.type === 'development')
  if (!devEnv) return '# No environments configured\n'
  const devVars = variables
    .filter((v) => v.environmentId === devEnv.id)
    .sort((a, b) => a.category.localeCompare(b.category) || a.key.localeCompare(b.key))
  const lines: string[] = ['# Generated by DevHub', '#']
  let lastCategory = ''
  for (const v of devVars) {
    if (v.category !== lastCategory) {
      lines.push('', `# --- ${v.category.toUpperCase().replace('_', ' ')} ---`)
      lastCategory = v.category
    }
    const desc = v.description ? ` # ${v.description}` : ''
    const req = v.required ? '' : ' # optional'
    lines.push(`${v.key}=${desc}${req}`)
  }
  return lines.join('\n') + '\n'
}

export async function bulkUpdateStatus(
  projectId: string,
  variableIds: string[],
  status: EnvVariableStatus
) {
  const envs = await prisma.environment.findMany({
    where: { projectId },
    select: { id: true },
  })
  const envIds = new Set(envs.map((e) => e.id))
  const variables = await prisma.envVariable.findMany({
    where: { id: { in: variableIds } },
    select: { id: true, environmentId: true },
  })
  const valid = variables.filter((v) => envIds.has(v.environmentId))
  if (valid.length === 0) throw new TRPCError({ code: 'NOT_FOUND' })
  await prisma.envVariable.updateMany({
    where: { id: { in: valid.map((v) => v.id) } },
    data: { status },
  })
}