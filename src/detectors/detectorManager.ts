/**
 * Detector Manager
 * Manages detector lifecycle and debounced execution.
 */
import { runEmotionDetection } from './emotionTracker'
import { detectForeshadowMentions, detectItemMentions } from './foreshadowDetector'
import { detectConflicts, type SettingConflict } from './conflictDefense'

export interface DetectorResults {
  emotions: boolean
  foreshadows: number
  items: number
  conflicts: SettingConflict[]
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null
const DEBOUNCE_MS = 3000

/**
 * Run all detectors on the given text (debounced).
 */
export function scheduleDetectorRun(
  chapterId: string,
  text: string,
  callback?: (results: DetectorResults) => void,
): void {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    const results = runAllDetectors(chapterId, text)
    callback?.(results)
  }, DEBOUNCE_MS)
}

/**
 * Run all detectors immediately.
 */
export function runAllDetectors(chapterId: string, text: string): DetectorResults {
  // Emotion tracking
  runEmotionDetection(chapterId, text)

  // Foreshadow detection
  const foreshadowMatches = detectForeshadowMentions(text)

  // Item detection
  const itemMentions = detectItemMentions(text)

  // Conflict detection
  const conflicts = detectConflicts(text)

  return {
    emotions: true,
    foreshadows: foreshadowMatches.length,
    items: itemMentions.length,
    conflicts,
  }
}

/**
 * Cancel any pending detector runs.
 */
export function cancelDetectorRun(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
}
