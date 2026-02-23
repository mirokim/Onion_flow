/**
 * Unit tests for backup module.
 * Tests: ProjectBackupSchema, sanitizeTextField, sanitizeRecord, downloadJSON.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProjectBackupSchema, sanitizeTextField, sanitizeRecord, downloadJSON } from '@/db/backup'

// ── Helpers ──

/** Minimal valid backup object that satisfies ProjectBackupSchema */
function makeValidBackup(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    exportedAt: 1700000000000,
    project: {
      id: 'proj-1',
      title: 'Test Project',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    },
    chapters: [
      {
        id: 'ch-1',
        projectId: 'proj-1',
        title: 'Chapter 1',
        order: 0,
        createdAt: 1700000000000,
        updatedAt: 1700000000000,
      },
    ],
    characters: [
      { id: 'char-1', projectId: 'proj-1', name: 'Hero' },
    ],
    relations: [
      { id: 'rel-1', projectId: 'proj-1', sourceId: 'char-1', targetId: 'char-2' },
    ],
    worldSettings: [
      { id: 'ws-1', projectId: 'proj-1', category: 'geography', title: 'Map' },
    ],
    foreshadows: [
      { id: 'fs-1', projectId: 'proj-1', title: 'Hint' },
    ],
    ...overrides,
  }
}

describe('backup', () => {
  // ── ProjectBackupSchema ──

  describe('ProjectBackupSchema', () => {
    it('should validate a minimal valid backup', () => {
      const result = ProjectBackupSchema.safeParse(makeValidBackup())
      expect(result.success).toBe(true)
    })

    it('should fail when project is missing', () => {
      const data = makeValidBackup()
      delete (data as any).project
      const result = ProjectBackupSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should fail when chapters is missing', () => {
      const data = makeValidBackup()
      delete (data as any).chapters
      const result = ProjectBackupSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should fail when characters is missing', () => {
      const data = makeValidBackup()
      delete (data as any).characters
      const result = ProjectBackupSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should fail when relations is missing', () => {
      const data = makeValidBackup()
      delete (data as any).relations
      const result = ProjectBackupSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should fail when worldSettings is missing', () => {
      const data = makeValidBackup()
      delete (data as any).worldSettings
      const result = ProjectBackupSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should fail when foreshadows is missing', () => {
      const data = makeValidBackup()
      delete (data as any).foreshadows
      const result = ProjectBackupSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should fail when version is not 1', () => {
      const data = makeValidBackup({ version: 2 })
      const result = ProjectBackupSchema.safeParse(data)
      expect(result.success).toBe(false)
    })

    it('should accept backup when optional fields are omitted', () => {
      const data = makeValidBackup()
      // Ensure none of the optional fields are present
      delete (data as any).items
      delete (data as any).referenceData
      delete (data as any).excalidrawData
      delete (data as any).entityVersions
      delete (data as any).aiConversations
      delete (data as any).aiMessages
      delete (data as any).onionNodes
      const result = ProjectBackupSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should accept backup with optional fields present', () => {
      const data = makeValidBackup({
        items: [{ id: 'i-1', projectId: 'proj-1', name: 'Sword' }],
        referenceData: [{ id: 'rd-1', projectId: 'proj-1', title: 'Notes' }],
        excalidrawData: { elements: [] },
        entityVersions: [{ id: 'v-1', entityId: 'ch-1' }],
        aiConversations: [{ id: 'ac-1', projectId: 'proj-1' }],
        aiMessages: [{ id: 'am-1', conversationId: 'ac-1' }],
        onionNodes: [{ id: 'on-1', chapterId: 'ch-1' }],
      })
      const result = ProjectBackupSchema.safeParse(data)
      expect(result.success).toBe(true)
    })

    it('should allow extra/passthrough fields on top-level object', () => {
      const data = makeValidBackup({ customField: 'extra-data' })
      const result = ProjectBackupSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect((result.data as any).customField).toBe('extra-data')
      }
    })

    it('should allow extra/passthrough fields on nested schemas', () => {
      const data = makeValidBackup()
      ;(data as any).project.customProjectField = 'extra'
      ;(data as any).characters[0].customCharField = 42
      const result = ProjectBackupSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect((result.data.project as any).customProjectField).toBe('extra')
        expect((result.data.characters[0] as any).customCharField).toBe(42)
      }
    })

    it('should default chapter parentId to null', () => {
      const data = makeValidBackup()
      // parentId is not provided in the chapter
      const result = ProjectBackupSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.chapters[0].parentId).toBe(null)
      }
    })

    it('should default chapter type to "chapter"', () => {
      const data = makeValidBackup()
      const result = ProjectBackupSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.chapters[0].type).toBe('chapter')
      }
    })

    it('should default chapter wordCount to 0', () => {
      const data = makeValidBackup()
      const result = ProjectBackupSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.chapters[0].wordCount).toBe(0)
      }
    })

    it('should default project description to empty string', () => {
      const data = makeValidBackup()
      // description is not provided in the project
      const result = ProjectBackupSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.project.description).toBe('')
      }
    })

    it('should default project genre to empty string', () => {
      const data = makeValidBackup()
      const result = ProjectBackupSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.project.genre).toBe('')
      }
    })

    it('should default project synopsis to empty string', () => {
      const data = makeValidBackup()
      const result = ProjectBackupSchema.safeParse(data)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.project.synopsis).toBe('')
      }
    })
  })

  // ── sanitizeTextField ──

  describe('sanitizeTextField', () => {
    it('should return string as-is when no dangerous content', () => {
      expect(sanitizeTextField('Hello World')).toBe('Hello World')
    })

    it('should strip <script> tags', () => {
      const result = sanitizeTextField('<script>alert(1)</script>')
      expect(result).not.toContain('<script')
      expect(result).not.toContain('</script>')
    })

    it('should strip <iframe> tags', () => {
      const result = sanitizeTextField('<iframe src="evil.com"></iframe>')
      expect(result).not.toContain('<iframe')
      expect(result).not.toContain('</iframe>')
    })

    it('should strip <svg> tags', () => {
      const result = sanitizeTextField('<svg onload="alert(1)"><circle/></svg>')
      expect(result).not.toContain('<svg')
    })

    it('should replace javascript: URLs with blocked:', () => {
      const result = sanitizeTextField('javascript:alert(1)')
      expect(result).toContain('blocked:')
      expect(result).not.toContain('javascript:')
    })

    it('should replace onclick= attributes with data-removed=', () => {
      const result = sanitizeTextField('<div onclick="alert(1)">click</div>')
      expect(result).toContain('data-removed=')
      expect(result).not.toMatch(/\sonclick=/)
    })

    it('should return empty string for null', () => {
      expect(sanitizeTextField(null)).toBe('')
    })

    it('should return empty string for undefined', () => {
      expect(sanitizeTextField(undefined)).toBe('')
    })

    it('should convert number to string', () => {
      expect(sanitizeTextField(42)).toBe('42')
    })

    it('should strip HTML entity encoded script tags', () => {
      const result = sanitizeTextField('&lt;script&gt;alert(1)&lt;/script&gt;')
      expect(result).not.toMatch(/&lt;script/i)
    })

    it('should strip nested/complex dangerous tags', () => {
      const input = '<div><script type="text/javascript">malicious()</script><p>safe</p></div>'
      const result = sanitizeTextField(input)
      expect(result).not.toContain('<script')
      expect(result).toContain('safe')
    })
  })

  // ── sanitizeRecord ──

  describe('sanitizeRecord', () => {
    it('should sanitize only the specified fields', () => {
      const record = {
        title: '<script>alert(1)</script>Title',
        name: '<script>xss</script>Name',
        count: 5,
      }
      const result = sanitizeRecord(record, ['title', 'name'])
      expect(result.title).not.toContain('<script')
      expect(result.name).not.toContain('<script')
    })

    it('should leave non-specified fields unchanged', () => {
      const record = {
        title: '<script>alert(1)</script>',
        description: '<script>safe because not listed</script>',
      }
      const result = sanitizeRecord(record, ['title'])
      expect(result.description).toBe('<script>safe because not listed</script>')
    })

    it('should leave non-string fields unchanged even if specified', () => {
      const record = {
        title: 'Clean',
        count: 42,
        active: true,
      }
      const result = sanitizeRecord(record, ['title', 'count', 'active'])
      expect(result.count).toBe(42)
      expect(result.active).toBe(true)
    })

    it('should return a new object without mutating the original', () => {
      const original = {
        title: '<script>xss</script>Hello',
        id: 'abc',
      }
      const result = sanitizeRecord(original, ['title'])
      expect(result).not.toBe(original)
      expect(original.title).toBe('<script>xss</script>Hello')
      expect(result.title).not.toContain('<script')
    })
  })

  // ── downloadJSON ──

  describe('downloadJSON', () => {
    let mockClick: ReturnType<typeof vi.fn>
    let mockAppendChild: ReturnType<typeof vi.fn>
    let mockRemoveChild: ReturnType<typeof vi.fn>
    let mockCreateObjectURL: ReturnType<typeof vi.fn>
    let mockRevokeObjectURL: ReturnType<typeof vi.fn>
    let createdElement: Record<string, any>

    beforeEach(() => {
      mockClick = vi.fn()
      mockAppendChild = vi.fn()
      mockRemoveChild = vi.fn()
      mockCreateObjectURL = vi.fn(() => 'blob:test-url')
      mockRevokeObjectURL = vi.fn()

      createdElement = {
        href: '',
        download: '',
        click: mockClick,
      }

      vi.spyOn(document, 'createElement').mockReturnValue(createdElement as any)
      vi.spyOn(document.body, 'appendChild').mockImplementation(mockAppendChild)
      vi.spyOn(document.body, 'removeChild').mockImplementation(mockRemoveChild)

      global.URL.createObjectURL = mockCreateObjectURL
      global.URL.revokeObjectURL = mockRevokeObjectURL
    })

    it('should create a Blob with correct JSON content', () => {
      const data = { hello: 'world' }
      downloadJSON(data, 'test.json')

      expect(mockCreateObjectURL).toHaveBeenCalledTimes(1)
      const blob = mockCreateObjectURL.mock.calls[0][0] as Blob
      expect(blob).toBeInstanceOf(Blob)
      expect(blob.type).toBe('application/json')
    })

    it('should set the download attribute to the filename', () => {
      downloadJSON({ a: 1 }, 'my-backup.json')

      expect(createdElement.download).toBe('my-backup.json')
    })

    it('should call click() on the anchor element', () => {
      downloadJSON({ x: true }, 'file.json')

      expect(mockClick).toHaveBeenCalledTimes(1)
    })

    it('should revoke the object URL after clicking', () => {
      downloadJSON({}, 'empty.json')

      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url')
    })
  })
})
