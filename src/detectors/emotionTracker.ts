/**
 * Emotion Tracker Detector
 * Analyzes character emotional states from text and records to DB.
 */
import { useEditorStore } from '@/stores/editorStore'
import { useWorldStore } from '@/stores/worldStore'
import { EMOTION_TYPES } from '@/ai/constants'

export interface EmotionSnapshot {
  characterId: string
  chapterId: string
  emotions: Record<string, number>
  timestamp: number
}

/**
 * Simple heuristic-based emotion detection from text.
 * Used as fallback when AI is not available.
 */
export function detectEmotionsFromText(
  text: string,
  characterName: string,
): Record<string, number> {
  const scores: Record<string, number> = {}
  for (const emotion of EMOTION_TYPES) {
    scores[emotion] = 0
  }

  const lower = text.toLowerCase()
  const charMentions = text.split(characterName).length - 1
  if (charMentions === 0) return scores

  // Simple keyword matching (Korean + English)
  const emotionKeywords: Record<string, string[]> = {
    joy: ['기쁘', '행복', '웃', '미소', '즐거', '환호', '기뻐', '좋아',
      'happy', 'joy', 'smile', 'laugh', 'cheer', 'delight', 'glad', 'grin'],
    sadness: ['슬프', '눈물', '울', '비통', '우울', '서글', '슬퍼', '아프',
      'sad', 'tear', 'cry', 'grief', 'sorrow', 'weep', 'mourn', 'depressed'],
    anger: ['분노', '화가', '격분', '이를 갈', '주먹을 쥐', '화난', '분했', '노여',
      'anger', 'fury', 'rage', 'furious', 'clench', 'scowl', 'livid', 'wrath'],
    fear: ['두려', '공포', '떨리', '무서', '겁', '벌벌', '두렵',
      'fear', 'terror', 'tremble', 'dread', 'scared', 'horror', 'panic'],
    surprise: ['놀라', '깜짝', '경악', '충격', '놀란', '어이없',
      'surprise', 'shock', 'astonish', 'stunned', 'gasp', 'startle'],
    love: ['사랑', '애정', '그리워', '따뜻', '포옹', '가슴이 뛰',
      'love', 'affection', 'embrace', 'warmth', 'longing', 'heart race'],
    tension: ['긴장', '조마조마', '불안', '위험', '급박', '심장이 빨라',
      'tense', 'anxious', 'nervous', 'danger', 'uneasy', 'dread'],
    determination: ['결심', '각오', '결의', '단호', '다짐', '반드시', '꼭',
      'determined', 'resolve', 'vow', 'unwavering', 'committed', 'sworn'],
  }

  for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
    let count = 0
    for (const kw of keywords) {
      const matches = lower.split(kw).length - 1
      count += matches
    }
    scores[emotion] = Math.min(10, count * 2)
  }

  return scores
}

/**
 * Record emotion data for a character in a chapter.
 */
export function recordEmotion(
  characterId: string,
  chapterId: string,
  emotions: Record<string, number>,
): void {
  useEditorStore.getState().setEmotionData(characterId, chapterId, emotions)
}

/**
 * Get all emotion data for a character across chapters.
 */
export function getCharacterEmotionArc(characterId: string): Record<string, Record<string, number>> {
  return useEditorStore.getState().emotionData[characterId] || {}
}

/**
 * Run emotion detection for all characters in a chapter's text.
 */
export function runEmotionDetection(chapterId: string, text: string): void {
  const characters = useWorldStore.getState().characters
  for (const char of characters) {
    if (text.includes(char.name)) {
      const emotions = detectEmotionsFromText(text, char.name)
      const hasNonZero = Object.values(emotions).some(v => v > 0)
      if (hasNonZero) {
        recordEmotion(char.id, chapterId, emotions)
      }
    }
  }
}
