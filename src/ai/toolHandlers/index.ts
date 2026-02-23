import type { ToolExecutionResult } from '../toolExecutor'
import { handleUpdateCharacter, handleDeleteCharacter } from './characterHandlers'
import { handleSaveWorldSetting, handleDeleteWorldSetting } from './worldSettingHandlers'
import { handleSaveItem, handleDeleteItem } from './itemHandlers'
import { handleSaveForeshadow, handleDeleteForeshadow } from './foreshadowHandlers'
import {
  handleSaveOutline, handleWriteChapterContent, handleAppendToChapter,
  handleCreateChapter, handleCreateVolume, handleRenameChapter,
} from './chapterHandlers'
import { handleGetCurrentState, handleCreateVersionSnapshot } from './queryHandlers'
import { handleSaveRelation, handleAnalyzeCharacterEmotions, handleSetEditorOption } from './miscHandlers'
import { handleCreateWikiEntry, handleUpdateWikiEntry, handleDeleteWikiEntry } from './wikiHandlers'

type ToolHandler = (params: Record<string, any>, projectId: string) => Promise<ToolExecutionResult>

export const TOOL_HANDLERS: Record<string, ToolHandler> = {
  save_outline: handleSaveOutline,
  write_chapter_content: handleWriteChapterContent,
  append_to_chapter: (p) => handleAppendToChapter(p),
  create_chapter: (p) => handleCreateChapter(p),
  create_volume: (p) => handleCreateVolume(p),
  rename_chapter: (p) => handleRenameChapter(p),

  update_character: handleUpdateCharacter,
  delete_character: (p) => handleDeleteCharacter(p),

  save_world_setting: handleSaveWorldSetting,
  delete_world_setting: (p) => handleDeleteWorldSetting(p),

  save_item: handleSaveItem,
  delete_item: (p) => handleDeleteItem(p),

  save_foreshadow: handleSaveForeshadow,
  delete_foreshadow: (p) => handleDeleteForeshadow(p),

  save_relation: handleSaveRelation,

  get_current_state: (p) => handleGetCurrentState(p),
  create_version_snapshot: handleCreateVersionSnapshot,

  analyze_character_emotions: (p) => handleAnalyzeCharacterEmotions(p),
  set_editor_option: (p) => handleSetEditorOption(p),

  create_wiki_entry: handleCreateWikiEntry,
  update_wiki_entry: (p) => handleUpdateWikiEntry(p),
  delete_wiki_entry: (p) => handleDeleteWikiEntry(p),

  respond: async (p) => ({ success: true, result: p.message || '' }),
}
