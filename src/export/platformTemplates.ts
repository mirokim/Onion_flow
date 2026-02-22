/**
 * Platform-specific formatting rules for web novel export.
 */

export interface PlatformTemplate {
  id: string
  name: string
  description: string
  maxCharsPerChapter: number
  lineBreakStyle: 'single' | 'double'
  dialogueFormat: 'korean_quotes' | 'angle_quotes'
  indentParagraphs: boolean
  mobileOptimized: boolean
}

export const PLATFORM_TEMPLATES: PlatformTemplate[] = [
  {
    id: 'munpia',
    name: '문피아',
    description: '5,500자 기준 자동 컷팅, 간결한 줄바꿈',
    maxCharsPerChapter: 5500,
    lineBreakStyle: 'single',
    dialogueFormat: 'korean_quotes',
    indentParagraphs: false,
    mobileOptimized: false,
  },
  {
    id: 'series',
    name: '네이버 시리즈',
    description: '모바일 가독성 최적화, 여백 확보',
    maxCharsPerChapter: 6000,
    lineBreakStyle: 'double',
    dialogueFormat: 'korean_quotes',
    indentParagraphs: false,
    mobileOptimized: true,
  },
  {
    id: 'kakaopage',
    name: '카카오페이지',
    description: '모바일 최적화, 대화문 포맷팅',
    maxCharsPerChapter: 5000,
    lineBreakStyle: 'double',
    dialogueFormat: 'korean_quotes',
    indentParagraphs: false,
    mobileOptimized: true,
  },
  {
    id: 'plain',
    name: '일반 텍스트',
    description: '포맷팅 없이 원본 그대로 내보내기',
    maxCharsPerChapter: 0, // no limit
    lineBreakStyle: 'single',
    dialogueFormat: 'korean_quotes',
    indentParagraphs: false,
    mobileOptimized: false,
  },
]
