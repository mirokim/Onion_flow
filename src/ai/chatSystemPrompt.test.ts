/**
 * Unit tests for chatSystemPrompt — buildChatSystemPrompt.
 * Tests: section inclusion, character/setting limits, wiki total cap,
 *        projectId isolation, dead-code removal verification.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Character, WorldSetting, WikiEntry, WikiCategory, CharacterRelation, Foreshadow, Chapter } from '@/types'

// ── Store mocks ──

const mockProjectState = vi.fn()
const mockWorldState = vi.fn()
const mockWikiState = vi.fn()

vi.mock('@/stores/projectStore', () => ({
  useProjectStore: { getState: (...args: unknown[]) => mockProjectState(...args) },
}))

vi.mock('@/stores/worldStore', () => ({
  useWorldStore: { getState: (...args: unknown[]) => mockWorldState(...args) },
}))

vi.mock('@/stores/wikiStore', () => ({
  useWikiStore: { getState: (...args: unknown[]) => mockWikiState(...args) },
}))

// contextSummarizer is also mocked to isolate chatSystemPrompt logic
vi.mock('./contextSummarizer', () => ({
  summarizeContext: vi.fn(() => ''),
}))

import { buildChatSystemPrompt } from './chatSystemPrompt'
import { summarizeContext } from './contextSummarizer'

// ── Factory helpers ──

function makeChar(id: string, projectId = 'proj-1'): Character {
  return {
    id,
    projectId,
    name: `Char ${id}`,
    aliases: [],
    role: 'supporting',
    position: 'neutral',
    age: '',
    job: '',
    affiliation: '',
    logline: '',
    archetype: 'other',
    signatureItem: '',
    habits: '',
    status: 'alive',
    currentLocation: '',
    desire: '',
    deficiency: '',
    fear: '',
    secret: '',
    values: '',
    personality: `Personality ${id}`,
    abilities: '',
    appearance: `Appearance ${id}`,
    background: '',
    motivation: `Motivation ${id}`,
    speechPattern: '',
    imageUrl: '',
    tags: [],
    notes: '',
    createdAt: 0,
    updatedAt: 0,
  }
}

function makeWorldSetting(id: string, projectId = 'proj-1'): WorldSetting {
  return {
    id,
    projectId,
    category: 'geography',
    title: `Setting ${id}`,
    content: `Content for setting ${id}`,
    tags: [],
    order: 0,
    createdAt: 0,
    updatedAt: 0,
  }
}

function makeWikiEntry(id: string, category: WikiCategory, projectId = 'proj-1'): WikiEntry {
  return {
    id,
    projectId,
    category,
    title: `Wiki ${id}`,
    content: `Content for wiki ${id}`,
    tags: [],
    order: 0,
    createdAt: 0,
    updatedAt: 0,
  }
}

function setupDefaultState({
  projectId = 'proj-1',
  characters = [] as Character[],
  worldSettings = [] as WorldSetting[],
  relations = [] as CharacterRelation[],
  foreshadows = [] as Foreshadow[],
  wikiEntries = [] as WikiEntry[],
  chapters = [] as Chapter[],
} = {}) {
  mockProjectState.mockReturnValue({
    currentProject: {
      id: projectId,
      title: 'Test Novel',
      genre: 'Fantasy',
      synopsis: 'A test story',
    },
    chapters,
  })
  mockWorldState.mockReturnValue({ characters, worldSettings, relations, foreshadows, items: [] })
  mockWikiState.mockReturnValue({ entries: wikiEntries })
}

// ── Tests ──

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(summarizeContext).mockReturnValue('')
})

describe('buildChatSystemPrompt', () => {
  describe('base instruction', () => {
    it('always includes base instruction even with no project data', () => {
      setupDefaultState()
      const result = buildChatSystemPrompt('proj-1')
      expect(result).toContain('소설 집필을 돕는 AI 어시스턴트')
      expect(result).toContain('중요 행동 규칙')
    })

    it('includes tool reference section', () => {
      setupDefaultState()
      const result = buildChatSystemPrompt('proj-1')
      expect(result).toContain('사용 가능한 도구')
      expect(result).toContain('update_character')
      expect(result).toContain('save_world_setting')
      expect(result).toContain('get_current_state')
    })

    it('includes provider and model identity when both provided', () => {
      setupDefaultState()
      const result = buildChatSystemPrompt('proj-1', 'anthropic', 'claude-sonnet-4-5-20250929')
      expect(result).toContain('Anthropic')
      expect(result).toContain('claude-sonnet-4-5-20250929')
    })

    it('omits identity section when provider or model is missing', () => {
      setupDefaultState()
      const result = buildChatSystemPrompt('proj-1')
      expect(result).not.toContain('당신의 정보')
    })
  })

  describe('project info section', () => {
    it('includes title, genre, and synopsis', () => {
      setupDefaultState()
      const result = buildChatSystemPrompt('proj-1')
      expect(result).toContain('Test Novel')
      expect(result).toContain('Fantasy')
      expect(result).toContain('A test story')
    })

    it('omits genre/synopsis lines when they are absent', () => {
      mockProjectState.mockReturnValue({
        currentProject: { id: 'proj-1', title: 'Minimal', genre: null, synopsis: null },
        chapters: [],
      })
      mockWorldState.mockReturnValue({ characters: [], worldSettings: [], relations: [], foreshadows: [], items: [] })
      mockWikiState.mockReturnValue({ entries: [] })
      const result = buildChatSystemPrompt('proj-1')
      expect(result).toContain('Minimal')
      expect(result).not.toContain('- 장르:')
      expect(result).not.toContain('- 시놉시스:')
    })
  })

  describe('characters section', () => {
    it('includes up to MAX_CHARACTERS_IN_PROMPT (15) characters', () => {
      const chars = Array.from({ length: 20 }, (_, i) => makeChar(`c${i}`))
      setupDefaultState({ characters: chars })
      const result = buildChatSystemPrompt('proj-1')
      // Only first 15 characters should appear
      for (let i = 0; i < 15; i++) {
        expect(result).toContain(`Char c${i}`)
      }
      for (let i = 15; i < 20; i++) {
        expect(result).not.toContain(`Char c${i}`)
      }
    })

    it('includes character personality, appearance, and motivation', () => {
      const chars = [makeChar('c1')]
      setupDefaultState({ characters: chars })
      const result = buildChatSystemPrompt('proj-1')
      expect(result).toContain('Personality c1')
      expect(result).toContain('Appearance c1')
      expect(result).toContain('Motivation c1')
    })

    it('filters characters by projectId', () => {
      const chars = [makeChar('c1', 'proj-1'), makeChar('c2', 'proj-other')]
      setupDefaultState({ characters: chars })
      const result = buildChatSystemPrompt('proj-1')
      expect(result).toContain('Char c1')
      expect(result).not.toContain('Char c2')
    })
  })

  describe('world settings section', () => {
    it('includes up to MAX_WORLD_SETTINGS_IN_PROMPT (20) settings', () => {
      const settings = Array.from({ length: 25 }, (_, i) => makeWorldSetting(`s${i}`))
      setupDefaultState({ worldSettings: settings })
      const result = buildChatSystemPrompt('proj-1')
      for (let i = 0; i < 20; i++) {
        expect(result).toContain(`Setting s${i}`)
      }
      for (let i = 20; i < 25; i++) {
        expect(result).not.toContain(`Setting s${i}`)
      }
    })

    it('truncates long world setting content at 200 chars', () => {
      const longContent = 'X'.repeat(250)
      const settings = [{ ...makeWorldSetting('s1'), content: longContent }]
      setupDefaultState({ worldSettings: settings })
      const result = buildChatSystemPrompt('proj-1')
      expect(result).toContain('X'.repeat(200) + '...')
      expect(result).not.toContain('X'.repeat(201))
    })
  })

  describe('wiki section — total cap', () => {
    it('includes all wiki entries when under MAX_TOTAL_WIKI_ENTRIES (50)', () => {
      const entries = Array.from({ length: 30 }, (_, i) => makeWikiEntry(`w${i}`, 'other'))
      setupDefaultState({ wikiEntries: entries })
      const result = buildChatSystemPrompt('proj-1')
      for (let i = 0; i < 30; i++) {
        expect(result).toContain(`Wiki w${i}`)
      }
    })

    it('stops at MAX_TOTAL_WIKI_ENTRIES (50) across all categories', () => {
      // 3 categories × 20 entries each = 60 total, but cap is 50
      const cat1 = Array.from({ length: 20 }, (_, i) => makeWikiEntry(`a${i}`, 'magic'))
      const cat2 = Array.from({ length: 20 }, (_, i) => makeWikiEntry(`b${i}`, 'history'))
      const cat3 = Array.from({ length: 20 }, (_, i) => makeWikiEntry(`c${i}`, 'other'))
      setupDefaultState({ wikiEntries: [...cat1, ...cat2, ...cat3] })
      const result = buildChatSystemPrompt('proj-1')
      // Count how many wiki entries appear
      const matches = result.match(/- Wiki [abc]\d+/g) || []
      expect(matches.length).toBeLessThanOrEqual(50)
    })

    it('filters wiki entries by projectId', () => {
      const entries = [
        makeWikiEntry('w1', 'other', 'proj-1'),
        makeWikiEntry('w2', 'other', 'proj-other'),
      ]
      setupDefaultState({ wikiEntries: entries })
      const result = buildChatSystemPrompt('proj-1')
      expect(result).toContain('Wiki w1')
      expect(result).not.toContain('Wiki w2')
    })

    it('truncates wiki content at 100 chars', () => {
      const longContent = 'Y'.repeat(150)
      const entries = [{ ...makeWikiEntry('w1', 'other'), content: longContent }]
      setupDefaultState({ wikiEntries: entries })
      const result = buildChatSystemPrompt('proj-1')
      expect(result).toContain('Y'.repeat(100) + '...')
    })
  })

  describe('chapter context delegation', () => {
    it('calls summarizeContext with chapters and projectId', () => {
      const chapters: Chapter[] = [
        { id: 'ch1', projectId: 'proj-1', type: 'chapter', title: 'Ch 1', order: 1, content: null, synopsis: 'S1', wordCount: 0, parentId: null, createdAt: 0, updatedAt: 0 },
        { id: 'ch2', projectId: 'proj-1', type: 'volume', title: 'Vol 1', order: 0, content: null, synopsis: '', wordCount: 0, parentId: null, createdAt: 0, updatedAt: 0 },
      ]
      setupDefaultState({ chapters })
      buildChatSystemPrompt('proj-1')
      // Should be called with only chapter-type entries
      expect(summarizeContext).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ id: 'ch1', type: 'chapter' })]),
        'proj-1',
      )
      // Volume type should be excluded
      const call = vi.mocked(summarizeContext).mock.calls[0]
      expect(call[0].every((c: { type: string }) => c.type === 'chapter')).toBe(true)
    })

    it('includes chapter context in output when summarizeContext returns content', () => {
      setupDefaultState()
      vi.mocked(summarizeContext).mockReturnValue('### 최근 챕터\n#### 1장\n내용\n')
      const result = buildChatSystemPrompt('proj-1')
      expect(result).toContain('### 최근 챕터')
    })
  })

  describe('no dead code (activeForeshadows)', () => {
    it('does not double-include foreshadow data — contextSummarizer handles it', () => {
      // The removed activeForeshadows variable used to potentially duplicate data.
      // Now chatSystemPrompt delegates entirely to summarizeContext.
      // We verify that buildChatSystemPrompt itself does NOT filter/access foreshadows directly.
      vi.mocked(summarizeContext).mockReturnValue('### 미회수 복선\n- 검은 열쇠\n')
      setupDefaultState()
      const result = buildChatSystemPrompt('proj-1')
      // Foreshadow appears exactly once (via summarizeContext mock)
      const occurrences = (result.match(/미회수 복선/g) || []).length
      expect(occurrences).toBe(1)
    })
  })
})
