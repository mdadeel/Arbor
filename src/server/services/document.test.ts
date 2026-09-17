import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  slugifyDoc,
  createDocument,
  updateDocument,
  restoreDocVersion,
  getDocTree,
  checkStaleness,
} from './document'
import { prisma } from '@/lib/prisma'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    document: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      updateMany: vi.fn(),
    },
    docVersion: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn((cb) => (typeof cb === 'function' ? cb(prisma) : Promise.all(cb))),
  },
}))

describe('slugifyDoc', () => {
  it('converts titles to clean kebab-case slugs', () => {
    expect(slugifyDoc('Getting Started & Quickstart')).toBe('getting-started-quickstart')
    expect(slugifyDoc('ADR-001: Use Next.js 14')).toBe('adr-001-use-next-js-14')
    expect(slugifyDoc('   Multiple    Spaces   ')).toBe('multiple-spaces')
  })
})

describe('Document Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates document and initial version snapshot (v1)', async () => {
    const mockCreatedDoc = {
      id: 'doc-1',
      projectId: 'proj-1',
      title: 'Architecture Overview',
      slug: 'architecture-overview',
      content: '# Arch',
      category: 'architecture',
      version: 1,
      parentId: null,
      sortOrder: 0,
      isStale: false,
    }

    vi.mocked(prisma.document.findFirst).mockResolvedValueOnce(null) // no slug collision
    vi.mocked(prisma.document.create).mockResolvedValueOnce(mockCreatedDoc as any)

    const doc = await createDocument('proj-1', {
      title: 'Architecture Overview',
      content: '# Arch',
      category: 'architecture',
    })

    expect(doc.id).toBe('doc-1')
    expect(doc.version).toBe(1)
    expect(prisma.document.create).toHaveBeenCalled()
    expect(prisma.docVersion.create).toHaveBeenCalledWith({
      data: {
        documentId: 'doc-1',
        version: 1,
        title: 'Architecture Overview',
        content: '# Arch',
        changeNote: 'Initial version',
      },
    })
  })

  it('updates document, increments version, and records version snapshot', async () => {
    const existingDoc = {
      id: 'doc-1',
      projectId: 'proj-1',
      title: 'Architecture Overview',
      slug: 'architecture-overview',
      content: '# Arch v1',
      category: 'architecture',
      version: 1,
    }

    const updatedDoc = {
      ...existingDoc,
      content: '# Arch v2',
      version: 2,
    }

    vi.mocked(prisma.document.findFirst).mockResolvedValueOnce(existingDoc as any)
    vi.mocked(prisma.document.update).mockResolvedValueOnce(updatedDoc as any)

    const result = await updateDocument('proj-1', 'doc-1', {
      content: '# Arch v2',
      changeNote: 'Added database diagram',
    })

    expect(result.version).toBe(2)
    expect(prisma.document.update).toHaveBeenCalledWith({
      where: { id: 'doc-1' },
      data: expect.objectContaining({
        content: '# Arch v2',
        version: 2,
      }),
    })
    expect(prisma.docVersion.create).toHaveBeenCalledWith({
      data: {
        documentId: 'doc-1',
        version: 2,
        title: 'Architecture Overview',
        content: '# Arch v2',
        changeNote: 'Added database diagram',
      },
    })
  })

  it('restores previous version content and creates new audit snapshot', async () => {
    const currentDoc = {
      id: 'doc-1',
      projectId: 'proj-1',
      title: 'Architecture Overview',
      slug: 'architecture-overview',
      content: '# Arch v2',
      category: 'architecture',
      version: 2,
    }

    const targetVersion = {
      id: 'ver-1',
      documentId: 'doc-1',
      version: 1,
      title: 'Architecture Overview v1',
      content: '# Arch v1 restored content',
      changeNote: 'Initial version',
    }

    const restoredDoc = {
      ...currentDoc,
      content: targetVersion.content,
      version: 3,
    }

    vi.mocked(prisma.document.findFirst).mockResolvedValueOnce(currentDoc as any)
    vi.mocked(prisma.docVersion.findUnique).mockResolvedValueOnce(targetVersion as any)
    vi.mocked(prisma.document.update).mockResolvedValueOnce(restoredDoc as any)

    const result = await restoreDocVersion('proj-1', 'doc-1', 1)
    expect(result.version).toBe(3)
    expect(result.content).toBe('# Arch v1 restored content')
    expect(prisma.docVersion.create).toHaveBeenCalledWith({
      data: {
        documentId: 'doc-1',
        version: 3,
        title: 'Architecture Overview v1',
        content: '# Arch v1 restored content',
        changeNote: 'Restored from version 1',
      },
    })
  })

  it('builds nested tree grouped by categories', async () => {
    const mockDocs = [
      {
        id: 'doc-parent',
        projectId: 'proj-1',
        title: 'System Design',
        slug: 'system-design',
        category: 'architecture',
        parentId: null,
        sortOrder: 0,
        version: 1,
        isStale: false,
        updatedAt: new Date(),
      },
      {
        id: 'doc-child',
        projectId: 'proj-1',
        title: 'Database Schema',
        slug: 'database-schema',
        category: 'architecture',
        parentId: 'doc-parent',
        sortOrder: 1,
        version: 1,
        isStale: false,
        updatedAt: new Date(),
      },
      {
        id: 'doc-guide',
        projectId: 'proj-1',
        title: 'Local Setup',
        slug: 'local-setup',
        category: 'guide',
        parentId: null,
        sortOrder: 0,
        version: 1,
        isStale: false,
        updatedAt: new Date(),
      },
    ]

    vi.mocked(prisma.document.findMany).mockResolvedValueOnce(mockDocs as any)

    const tree = await getDocTree('proj-1')
    expect(tree.architecture).toHaveLength(1)
    expect(tree.architecture[0].id).toBe('doc-parent')
    expect(tree.architecture[0].children).toHaveLength(1)
    expect(tree.architecture[0].children[0].id).toBe('doc-child')
    expect(tree.guide).toHaveLength(1)
    expect(tree.guide[0].id).toBe('doc-guide')
  })

  it('detects and flags stale documents based on age or review date', async () => {
    const ninetyOneDaysAgo = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000)
    const mockStaleDocs = [
      {
        id: 'stale-1',
        projectId: 'proj-1',
        title: 'Old Runbook',
        updatedAt: ninetyOneDaysAgo,
        reviewDate: null,
        isStale: false,
      },
      {
        id: 'stale-2',
        projectId: 'proj-1',
        title: 'Past Review ADR',
        updatedAt: new Date(),
        reviewDate: new Date(Date.now() - 1000), // past
        isStale: false,
      },
    ]

    vi.mocked(prisma.document.findMany).mockResolvedValueOnce(mockStaleDocs as any)

    const staleIds = await checkStaleness('proj-1')
    expect(staleIds).toEqual(['stale-1', 'stale-2'])
    expect(prisma.document.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['stale-1', 'stale-2'] } },
      data: { isStale: true },
    })
  })
})
