/**
 * Unit tests for contextSummarizer module.
 * Tests: summarizeContext with various chapter counts, synopsis truncation,
 *        foreshadow filtering (by status AND projectId), and importance prefixes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Chapter, Foreshadow } from '@/types'

vi.mock('@/stores/worldStore', () => ({
  useWorldStore: {
    getState: vi.fn(() => ({
      foreshadows: [] as Foreshadow[],
    })),
  },
}))

import { summarizeContext } from './contextSummarizer'
import { useWorldStore } from '@/stores/worldStore'

// ── Helpers ──

function makeChapter(overrides: Partial<Chapter> & { order: number; title: string }): Chapter {
  return {
    id: overrides.id ?? `ch-${overrides.order}`,
    projectId: overrides.projectId ?? 'proj-1',
    title: overrides.title,
    order: overrides.order,
    parentId: overrides.parentId ?? null,
    type: overrides.type ?? 'chapter',
    content: overrides.content ?? null,
    synopsis: overrides.synopsis ?? '',
    wordCount: overrides.wordCount ?? 0,
    createdAt: overrides.createdAt ?? Date.now(),
    updatedAt: overrides.updatedAt ?? Date.now(),
  }
}

function makeForeshadow(overrides: Partial<Foreshadow>): Foreshadow {
  return {
    id: overrides.id ?? 'fs-1',
    projectId: overrides.projectId ?? 'proj-1',
    title: overrides.title ?? 'Untitled Foreshadow',
    description: overrides.description ?? '',
    status: overrides.status ?? 'planted',
    plantedChapterId: overrides.plantedChapterId ?? null,
    resolvedChapterId: overrides.resolvedChapterId ?? null,
    importance: overrides.importance ?? 'medium',
    tags: overrides.tags ?? [],
    notes: overrides.notes ?? '',
    createdAt: overrides.createdAt ?? Date.now(),
    updatedAt: overrides.updatedAt ?? Date.now(),
  }
}

function setForeshadows(foreshadows: Foreshadow[]) {
  vi.mocked(useWorldStore.getState).mockReturnValue({
    foreshadows,
  } as any)
}

// ── Tests ──

beforeEach(() => {
  setForeshadows([])
})

describe('summarizeContext', () => {
  it('returns empty string for empty chapters array', () => {
    expect(summarizeContext([], 'proj-1')).toBe('')
  })

  it('places a single chapter under recent section', () => {
    const chapters = [makeChapter({ order: 1, title: '1장', synopsis: '첫 번째 챕터 시놉시스' })]
    const result = summarizeContext(chapters, 'proj-1')

    expect(result).toContain('### 최근 챕터')
    expect(result).toContain('#### 1장')
    expect(result).toContain('첫 번째 챕터 시놉시스')
    expect(result).not.toContain('### 이전 챕터 요약')
  })

  it('places all 3 chapters under recent section when there are exactly 3', () => {
    const chapters = [
      makeChapter({ order: 1, title: '1장', synopsis: '시놉시스 1' }),
      makeChapter({ order: 2, title: '2장', synopsis: '시놉시스 2' }),
      makeChapter({ order: 3, title: '3장', synopsis: '시놉시스 3' }),
    ]
    const result = summarizeContext(chapters, 'proj-1')

    expect(result).toContain('### 최근 챕터')
    expect(result).toContain('#### 1장')
    expect(result).toContain('#### 2장')
    expect(result).toContain('#### 3장')
    expect(result).not.toContain('### 이전 챕터 요약')
  })

  it('splits 5 chapters into 2 older and 3 recent', () => {
    const chapters = Array.from({ length: 5 }, (_, i) =>
      makeChapter({ order: i + 1, title: `${i + 1}장`, synopsis: `시놉시스 ${i + 1}` }),
    )
    const result = summarizeContext(chapters, 'proj-1')

    // Older section: first 2 chapters
    expect(result).toContain('### 이전 챕터 요약')
    expect(result).toContain('- 1장: 시놉시스 1')
    expect(result).toContain('- 2장: 시놉시스 2')

    // Recent section: last 3 chapters
    expect(result).toContain('### 최근 챕터')
    expect(result).toContain('#### 3장')
    expect(result).toContain('#### 4장')
    expect(result).toContain('#### 5장')
  })

  it('limits older chapters to 10 when there are 15 total', () => {
    const chapters = Array.from({ length: 15 }, (_, i) =>
      makeChapter({ order: i + 1, title: `${i + 1}장`, synopsis: `시놉시스 ${i + 1}` }),
    )
    const result = summarizeContext(chapters, 'proj-1')

    // Older section: only the last 10 of the first 12 (i.e., chapters 3-12)
    expect(result).toContain('### 이전 챕터 요약')
    // Chapters 1 and 2 are beyond the max-older-10 window
    expect(result).not.toContain('- 1장:')
    expect(result).not.toContain('- 2장:')
    // Chapters 3 through 12 should appear as older
    expect(result).toContain('- 3장: 시놉시스 3')
    expect(result).toContain('- 12장: 시놉시스 12')

    // Recent section: last 3 chapters (13, 14, 15)
    expect(result).toContain('### 최근 챕터')
    expect(result).toContain('#### 13장')
    expect(result).toContain('#### 14장')
    expect(result).toContain('#### 15장')
  })

  it('truncates synopsis longer than 200 characters with "..."', () => {
    const longSynopsis = 'A'.repeat(250)
    const chapters = [
      makeChapter({ order: 1, title: '긴 챕터', synopsis: longSynopsis }),
      // Need at least 4 chapters so chapter 1 is in the older section (truncation applies there)
      makeChapter({ order: 2, title: '2장', synopsis: '시놉시스' }),
      makeChapter({ order: 3, title: '3장', synopsis: '시놉시스' }),
      makeChapter({ order: 4, title: '4장', synopsis: '시놉시스' }),
    ]
    const result = summarizeContext(chapters, 'proj-1')

    // The older section should have truncated synopsis
    expect(result).toContain('- 긴 챕터: ' + 'A'.repeat(200) + '...')
  })

  it('shows "(시놉시스 없음)" when synopsis is empty', () => {
    const chapters = [
      makeChapter({ order: 1, title: '빈 챕터', synopsis: '' }),
      makeChapter({ order: 2, title: '2장', synopsis: '시놉시스' }),
      makeChapter({ order: 3, title: '3장', synopsis: '시놉시스' }),
      makeChapter({ order: 4, title: '4장', synopsis: '시놉시스' }),
    ]
    const result = summarizeContext(chapters, 'proj-1')

    // Older section: chapter 1 has no synopsis
    expect(result).toContain('- 빈 챕터: (시놉시스 없음)')

    // Also test a recent chapter with no synopsis
    const chaptersRecent = [makeChapter({ order: 1, title: '빈 최근', synopsis: '' })]
    const resultRecent = summarizeContext(chaptersRecent, 'proj-1')
    expect(resultRecent).toContain('(시놉시스 없음)')
  })

  it('lists active foreshadows (planted/hinted) under "미회수 복선"', () => {
    setForeshadows([
      makeForeshadow({ id: 'fs-1', title: '검은 열쇠', description: '문 뒤의 비밀', status: 'planted', importance: 'medium' }),
      makeForeshadow({ id: 'fs-2', title: '예언', description: '주인공의 운명', status: 'hinted', importance: 'medium' }),
    ])

    const chapters = [makeChapter({ order: 1, title: '1장', synopsis: '시놉시스' })]
    const result = summarizeContext(chapters, 'proj-1')

    expect(result).toContain('### 미회수 복선')
    expect(result).toContain('검은 열쇠: 문 뒤의 비밀')
    expect(result).toContain('예언: 주인공의 운명')
  })

  it('excludes resolved and abandoned foreshadows', () => {
    setForeshadows([
      makeForeshadow({ id: 'fs-1', title: '해결된 복선', description: '이미 해결됨', status: 'resolved', importance: 'medium' }),
      makeForeshadow({ id: 'fs-2', title: '포기된 복선', description: '포기됨', status: 'abandoned', importance: 'medium' }),
      makeForeshadow({ id: 'fs-3', title: '활성 복선', description: '아직 활성', status: 'planted', importance: 'medium' }),
    ])

    const chapters = [makeChapter({ order: 1, title: '1장', synopsis: '시놉시스' })]
    const result = summarizeContext(chapters, 'proj-1')

    expect(result).toContain('### 미회수 복선')
    expect(result).toContain('활성 복선: 아직 활성')
    expect(result).not.toContain('해결된 복선')
    expect(result).not.toContain('포기된 복선')
  })

  it('prefixes critical foreshadows with "⚠️" and high with "❗"', () => {
    setForeshadows([
      makeForeshadow({ id: 'fs-c', title: '치명적 복선', description: '매우 중요', status: 'planted', importance: 'critical' }),
      makeForeshadow({ id: 'fs-h', title: '높은 복선', description: '중요', status: 'hinted', importance: 'high' }),
      makeForeshadow({ id: 'fs-m', title: '보통 복선', description: '보통', status: 'planted', importance: 'medium' }),
      makeForeshadow({ id: 'fs-l', title: '낮은 복선', description: '낮음', status: 'planted', importance: 'low' }),
    ])

    const chapters = [makeChapter({ order: 1, title: '1장', synopsis: '시놉시스' })]
    const result = summarizeContext(chapters, 'proj-1')

    expect(result).toContain('- ⚠️치명적 복선: 매우 중요')
    expect(result).toContain('- ❗높은 복선: 중요')
    // Medium and low have no prefix
    expect(result).toContain('- 보통 복선: 보통')
    expect(result).toContain('- 낮은 복선: 낮음')
  })

  // ── Bug #1 regression: foreshadows must be filtered by projectId ──

  it('excludes foreshadows from other projects (Bug #1 regression)', () => {
    setForeshadows([
      makeForeshadow({ id: 'fs-mine', title: '내 복선', description: '이 프로젝트', status: 'planted', projectId: 'proj-1' }),
      makeForeshadow({ id: 'fs-other', title: '타 프로젝트 복선', description: '다른 프로젝트', status: 'planted', projectId: 'proj-other' }),
    ])

    const chapters = [makeChapter({ order: 1, title: '1장', synopsis: '시놉시스', projectId: 'proj-1' })]
    const result = summarizeContext(chapters, 'proj-1')

    expect(result).toContain('내 복선')
    expect(result).not.toContain('타 프로젝트 복선')
  })

  it('shows no foreshadow section when all active foreshadows belong to another project', () => {
    setForeshadows([
      makeForeshadow({ id: 'fs-other', title: '타 프로젝트 복선', status: 'planted', projectId: 'proj-other' }),
    ])

    const chapters = [makeChapter({ order: 1, title: '1장', synopsis: '시놉시스', projectId: 'proj-1' })]
    const result = summarizeContext(chapters, 'proj-1')

    expect(result).not.toContain('### 미회수 복선')
    expect(result).not.toContain('타 프로젝트 복선')
  })

  it('shows foreshadows for the requested projectId when multiple projects exist', () => {
    setForeshadows([
      makeForeshadow({ id: 'fs-a', title: '프로젝트A 복선', status: 'planted', projectId: 'proj-a' }),
      makeForeshadow({ id: 'fs-b', title: '프로젝트B 복선', status: 'planted', projectId: 'proj-b' }),
    ])

    const chaptersA = [makeChapter({ order: 1, title: '1장', synopsis: '시놉시스', projectId: 'proj-a' })]
    const resultA = summarizeContext(chaptersA, 'proj-a')
    expect(resultA).toContain('프로젝트A 복선')
    expect(resultA).not.toContain('프로젝트B 복선')

    const chaptersB = [makeChapter({ order: 1, title: '1장', synopsis: '시놉시스', projectId: 'proj-b' })]
    const resultB = summarizeContext(chaptersB, 'proj-b')
    expect(resultB).toContain('프로젝트B 복선')
    expect(resultB).not.toContain('프로젝트A 복선')
  })
})
