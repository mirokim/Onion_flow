/**
 * Reader (독자 시점) node plugin.
 *
 * Simulates a specific type of reader reading the upstream story content
 * and generates a realistic review comment in that reader's voice.
 *
 * Reader types span a range of personas — from casual general readers
 * to hardcore genre fans and professional editors/critics.
 */
import { registerPlugin } from '../plugin'
import { NODE_CATEGORY_COLORS } from '../types'
import type { NodeBodyProps } from '../plugin'
import { useCanvasStore } from '@/stores/canvasStore'
import { useAIStore } from '@/stores/aiStore'
import { cn } from '@/lib/utils'

// ── Reader type definitions ────────────────────────────────────────────────────

interface ReaderType {
  id: string
  label: string
  emoji: string
  description: string
}

const READER_TYPES: ReaderType[] = [
  { id: 'general',   label: '일반 독자',   emoji: '📚', description: '평범한 독자. 재미와 몰입감 위주로 평가한다.' },
  { id: 'romance',   label: '로맨스 독자', emoji: '💕', description: '로맨스 전문 독자. 감정선·설렘·커플 케미 중심으로 본다.' },
  { id: 'fantasy',   label: '판타지 독자', emoji: '🧙', description: '판타지 장르 독자. 세계관 설정과 마법 시스템에 민감하다.' },
  { id: 'mystery',   label: '추리 독자',   emoji: '🔍', description: '추리·스릴러 독자. 단서 배치와 반전의 논리성을 따진다.' },
  { id: 'critic',    label: '문학 비평가', emoji: '🎓', description: '전문 비평가. 문체·상징·주제 의식을 학술적으로 분석한다.' },
  { id: 'editor',    label: '편집자',      emoji: '✏️', description: '출판사 편집자. 상업성·독자층·구조적 문제점을 지적한다.' },
  { id: 'teen',      label: '10대 독자',   emoji: '🌟', description: '10대 독자. 공감 가능한 캐릭터와 트렌디한 요소를 선호한다.' },
  { id: 'superfan',  label: '열혈 팬',     emoji: '🔥', description: '극성 팬. 작가의 이전 작품과 비교하며 세부 설정에 집착한다.' },
]

const READER_MAP = Object.fromEntries(READER_TYPES.map(r => [r.id, r]))

// ── Body Component ─────────────────────────────────────────────────────────────

function ReaderNodeBody({ nodeId, data }: NodeBodyProps) {
  const selectedType = (data.readerType as string) || 'general'
  const reader = READER_MAP[selectedType] ?? READER_TYPES[0]

  return (
    <div className="mt-1.5 space-y-1.5">

      {/* Reader type selector */}
      <div className="grid grid-cols-2 gap-0.5">
        {READER_TYPES.map((r) => (
          <button
            key={r.id}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              useCanvasStore.getState().updateNodeData(nodeId, { readerType: r.id })
            }}
            title={r.description}
            className={cn(
              'text-[8px] py-0.5 px-1 rounded border transition-colors text-left truncate',
              selectedType === r.id
                ? 'bg-accent text-white border-accent font-semibold'
                : 'bg-bg-primary text-text-muted border-border hover:border-accent',
            )}
          >
            {r.emoji} {r.label}
          </button>
        ))}
      </div>

      {/* Current selection description */}
      <p className="text-[8px] text-text-muted/60 leading-relaxed italic">
        {reader.description}
      </p>
    </div>
  )
}

// ── Per-reader system prompts ──────────────────────────────────────────────────

function buildReaderPrompt(readerId: string): string {
  const prompts: Record<string, string> = {
    general: [
      '당신은 취미로 소설을 즐겨 읽는 평범한 독자입니다.',
      '읽은 내용에 대해 솔직하고 자연스러운 감상 댓글을 남겨 주세요.',
      '재미있었던 점, 몰입이 안 됐던 점, 다음 내용이 궁금한지 등을 자유롭게 이야기하세요.',
    ].join('\n'),

    romance: [
      '당신은 로맨스 소설 전문 독자입니다. 감정선과 설렘 묘사에 매우 민감합니다.',
      '두 캐릭터 사이의 케미, 심장 두근거리는 장면, 갈등과 화해의 감정적 흐름을 중점적으로 평가하세요.',
      '로맨스 독자 특유의 리액션(설레발, 애태움, 감정이입)을 생생하게 표현해 주세요.',
    ].join('\n'),

    fantasy: [
      '당신은 판타지 장르에 정통한 독자입니다. 세계관 설정과 내적 일관성을 매우 중시합니다.',
      '마법 시스템, 세계관 규칙, 설정의 독창성과 논리적 완결성을 분석하세요.',
      '기존 판타지 작품과의 차별점이 있는지도 짚어 주세요.',
    ].join('\n'),

    mystery: [
      '당신은 추리·스릴러 소설 마니아입니다. 복선, 단서, 반전의 논리성을 꼼꼼히 따집니다.',
      '플롯의 허점이나 알리바이 오류, 단서가 공정하게 배치됐는지 평가하세요.',
      '독자를 속인 방식이 정당한지, 반전이 충격적이고 납득 가능한지 의견을 남겨 주세요.',
    ].join('\n'),

    critic: [
      '당신은 전문 문학 비평가입니다. 학술적이고 분석적인 시각으로 작품을 평가합니다.',
      '문체의 특징, 상징과 은유의 활용, 주제 의식의 깊이, 서사 구조의 완성도를 분석하세요.',
      '비교 문학적 관점에서 이 작품의 문학적 가치와 한계를 냉정하게 지적해 주세요.',
    ].join('\n'),

    editor: [
      '당신은 출판사 편집자입니다. 상업적 가능성과 독자층, 구조적 문제를 파악하는 전문가입니다.',
      '타깃 독자층이 명확한지, 시작 부분이 독자를 충분히 끌어당기는지 평가하세요.',
      '출판 가능성, 수정이 필요한 구조적 약점, 마케팅 포인트에 대한 의견을 주세요.',
    ].join('\n'),

    teen: [
      '당신은 소설을 좋아하는 10대입니다. 트렌디하고 공감 가능한 요소를 선호합니다.',
      '주인공에게 얼마나 공감됐는지, 친구들에게 추천하고 싶은지 솔직하게 말해 주세요.',
      '지루하거나 어색한 부분, 반대로 너무 재밌어서 밤새웠을 것 같은 부분도 이야기하세요.',
    ].join('\n'),

    superfan: [
      '당신은 이 작가의 모든 작품을 외우는 열혈 팬입니다. 세부 설정에 집착하는 성격입니다.',
      '이전 작품 대비 달라진 점, 작가 특유의 스타일이 살아있는지, 떡밥이 잘 뿌려졌는지 분석하세요.',
      '팬 커뮤니티 글 쓰듯 흥분된 톤으로, 궁금한 설정 질문도 섞어가며 댓글을 남겨 주세요.',
    ].join('\n'),
  }
  return prompts[readerId] ?? prompts.general
}

// ── Plugin registration ────────────────────────────────────────────────────────

registerPlugin({
  definition: {
    type: 'reader',
    label: 'Reader Perspective',
    labelKo: '🤖 독자 시점',
    category: 'special',
    tags: ['special', 'ai'],
    color: NODE_CATEGORY_COLORS.special,
    inputs: [
      {
        id: 'in',
        label: 'Story',
        type: 'target',
        position: 'left',
        acceptsTypes: ['TEXT', 'CONTEXT'],
      },
    ],
    outputs: [
      {
        id: 'out',
        label: 'Comment',
        type: 'source',
        position: 'right',
        dataType: 'TEXT',
      },
    ],
    defaultData: {
      label: '🤖 독자 시점',
      readerType: 'general',
    },
  },

  bodyComponent: ReaderNodeBody,
  isExecutable: true,

  execute: async (node, collectContext) => {
    const context = collectContext(node.id)
    if (!context.trim()) return '스토리 텍스트를 연결해 주세요.'

    const readerId = (node.data.readerType as string) || 'general'
    const reader   = READER_MAP[readerId] ?? READER_TYPES[0]

    const { callWithTools } = await import('@/ai/providers')
    const aiStore  = useAIStore.getState()
    const provider = aiStore.activeProviders[0]
    if (!provider) throw new Error('활성화된 AI 프로바이더가 없습니다.')
    const config = aiStore.configs[provider]

    const systemPrompt = [
      buildReaderPrompt(readerId),
      '',
      '📌 응답 형식:',
      '- 3~6 문장의 자연스러운 독자 댓글 스타일로 작성',
      '- 해당 독자 유형의 말투와 관심사를 생생하게 반영',
      '- 긍정적 의견과 아쉬운 점을 모두 포함',
    ].join('\n')

    const resp = await callWithTools(
      config,
      [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            `다음 소설 내용을 읽고 **${reader.emoji} ${reader.label}** 입장에서 솔직한 감상 댓글을 남겨 주세요:`,
            '',
            context,
          ].join('\n'),
        },
      ],
      false,
    )

    return `${reader.emoji} **${reader.label}**\n\n${resp.content}`
  },
})
