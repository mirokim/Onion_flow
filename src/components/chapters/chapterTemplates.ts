/**
 * Chapter/Volume templates for quick project structure creation.
 */

export interface ChapterTemplateItem {
  title: string
  type: 'volume' | 'chapter'
  children?: ChapterTemplateItem[]
}

export interface ChapterTemplate {
  id: string
  nameKo: string
  nameEn: string
  description: string
  structure: ChapterTemplateItem[]
}

export const CHAPTER_TEMPLATES: ChapterTemplate[] = [
  {
    id: 'three_part',
    nameKo: '3부작 구조',
    nameEn: 'Three-Part Structure',
    description: '도입부/전개부/결말부로 나뉜 기본 구조',
    structure: [
      {
        title: '제1부: 도입',
        type: 'volume',
        children: [
          { title: '제1장: 시작', type: 'chapter' },
          { title: '제2장: 만남', type: 'chapter' },
          { title: '제3장: 갈등의 씨앗', type: 'chapter' },
        ],
      },
      {
        title: '제2부: 전개',
        type: 'volume',
        children: [
          { title: '제4장: 시련', type: 'chapter' },
          { title: '제5장: 성장', type: 'chapter' },
          { title: '제6장: 위기', type: 'chapter' },
          { title: '제7장: 절정', type: 'chapter' },
        ],
      },
      {
        title: '제3부: 결말',
        type: 'volume',
        children: [
          { title: '제8장: 전환', type: 'chapter' },
          { title: '제9장: 해결', type: 'chapter' },
          { title: '제10장: 에필로그', type: 'chapter' },
        ],
      },
    ],
  },
  {
    id: 'five_act',
    nameKo: '5막 구조',
    nameEn: 'Five-Act Structure',
    description: '발단/상승/절정/하강/대단원',
    structure: [
      {
        title: '제1막: 발단',
        type: 'volume',
        children: [
          { title: '장면 1: 도입', type: 'chapter' },
          { title: '장면 2: 사건의 시작', type: 'chapter' },
        ],
      },
      {
        title: '제2막: 상승',
        type: 'volume',
        children: [
          { title: '장면 3: 갈등 심화', type: 'chapter' },
          { title: '장면 4: 복잡화', type: 'chapter' },
        ],
      },
      {
        title: '제3막: 절정',
        type: 'volume',
        children: [
          { title: '장면 5: 클라이맥스', type: 'chapter' },
        ],
      },
      {
        title: '제4막: 하강',
        type: 'volume',
        children: [
          { title: '장면 6: 결과', type: 'chapter' },
          { title: '장면 7: 반전', type: 'chapter' },
        ],
      },
      {
        title: '제5막: 대단원',
        type: 'volume',
        children: [
          { title: '장면 8: 해결', type: 'chapter' },
          { title: '장면 9: 에필로그', type: 'chapter' },
        ],
      },
    ],
  },
  {
    id: 'webnovel',
    nameKo: '웹소설 템플릿',
    nameEn: 'Web Novel',
    description: '프롤로그 + 에피소드 형식',
    structure: [
      { title: '프롤로그', type: 'chapter' },
      {
        title: '제1권',
        type: 'volume',
        children: [
          { title: '1화', type: 'chapter' },
          { title: '2화', type: 'chapter' },
          { title: '3화', type: 'chapter' },
          { title: '4화', type: 'chapter' },
          { title: '5화', type: 'chapter' },
          { title: '6화', type: 'chapter' },
          { title: '7화', type: 'chapter' },
          { title: '8화', type: 'chapter' },
          { title: '9화', type: 'chapter' },
          { title: '10화', type: 'chapter' },
        ],
      },
    ],
  },
  {
    id: 'light_novel',
    nameKo: '라이트노벨 템플릿',
    nameEn: 'Light Novel',
    description: '권별 볼륨 + 챕터 구조',
    structure: [
      {
        title: '제1권: 시작',
        type: 'volume',
        children: [
          { title: '프롤로그', type: 'chapter' },
          { title: '제1장', type: 'chapter' },
          { title: '제2장', type: 'chapter' },
          { title: '제3장', type: 'chapter' },
          { title: '제4장', type: 'chapter' },
          { title: '에필로그', type: 'chapter' },
        ],
      },
      {
        title: '제2권: 전개',
        type: 'volume',
        children: [
          { title: '프롤로그', type: 'chapter' },
          { title: '제1장', type: 'chapter' },
          { title: '제2장', type: 'chapter' },
          { title: '제3장', type: 'chapter' },
          { title: '제4장', type: 'chapter' },
          { title: '에필로그', type: 'chapter' },
        ],
      },
    ],
  },
  {
    id: 'short_stories',
    nameKo: '단편 모음집',
    nameEn: 'Short Story Collection',
    description: '독립 에피소드 구조',
    structure: [
      { title: '단편 1: 제목 미정', type: 'chapter' },
      { title: '단편 2: 제목 미정', type: 'chapter' },
      { title: '단편 3: 제목 미정', type: 'chapter' },
      { title: '단편 4: 제목 미정', type: 'chapter' },
      { title: '단편 5: 제목 미정', type: 'chapter' },
    ],
  },
]
