/**
 * Unit tests for aiStore.
 * Tests: config management, custom models, chat messages, triple mode,
 *        conversations CRUD, prompt templates, context injection,
 *        API key obfuscation.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useAIStore } from './aiStore'
import type { AIProvider } from '@/types'

// ── Mock the storage adapter ──
const mockAdapter = {
  fetchConversations: vi.fn().mockResolvedValue([]),
  insertConversation: vi.fn().mockResolvedValue(undefined),
  updateConversation: vi.fn().mockResolvedValue(undefined),
  deleteConversation: vi.fn().mockResolvedValue(undefined),
  fetchMessages: vi.fn().mockResolvedValue([]),
  insertMessage: vi.fn().mockResolvedValue(undefined),
}

vi.mock('@/db/storageAdapter', () => ({
  getAdapter: () => mockAdapter,
}))

let idCounter = 0
vi.mock('@/lib/utils', () => ({
  generateId: () => `test-id-${++idCounter}`,
}))

vi.mock('@/lib/dateUtils', () => ({
  nowUTC: () => 1700000000000,
}))

function resetStore() {
  useAIStore.setState({
    configs: {
      openai: { provider: 'openai', apiKey: '', model: 'gpt-4.1', enabled: false },
      anthropic: { provider: 'anthropic', apiKey: '', model: 'claude-sonnet-4-5-20250929', enabled: false },
      gemini: { provider: 'gemini', apiKey: '', model: 'gemini-2.5-flash', enabled: false },
      llama: { provider: 'llama', apiKey: '', model: 'meta-llama/Llama-4-Scout-17B-16E-Instruct', enabled: false },
      grok: { provider: 'grok', apiKey: '', model: 'grok-3-latest', enabled: false },
    },
    activeProviders: [],
    tripleMode: false,
    messages: [],
    tripleMessages: { openai: [], anthropic: [], gemini: [], llama: [], grok: [] },
    isLoading: { openai: false, anthropic: false, gemini: false, llama: false, grok: false },
    conversations: [],
    currentConversationId: null,
    contextInjection: 'ask',
    customModels: { openai: [], anthropic: [], gemini: [], llama: [], grok: [] },
  })
}

describe('aiStore', () => {
  beforeEach(() => {
    idCounter = 0
    resetStore()
    vi.clearAllMocks()
  })

  // ── Config Management ──

  describe('updateConfig', () => {
    it('should update a provider config', () => {
      useAIStore.getState().updateConfig('openai', { apiKey: 'sk-test', enabled: true })

      const config = useAIStore.getState().configs.openai
      expect(config.apiKey).toBe('sk-test')
      expect(config.enabled).toBe(true)
    })

    it('should add provider to activeProviders when enabled with apiKey', () => {
      useAIStore.getState().updateConfig('openai', { apiKey: 'sk-test', enabled: true })

      expect(useAIStore.getState().activeProviders).toContain('openai')
    })

    it('should remove provider from activeProviders when disabled', () => {
      useAIStore.getState().updateConfig('openai', { apiKey: 'sk-test', enabled: true })
      useAIStore.getState().updateConfig('openai', { enabled: false })

      expect(useAIStore.getState().activeProviders).not.toContain('openai')
    })

    it('should not include provider in activeProviders if apiKey is empty and no baseUrl', () => {
      useAIStore.getState().updateConfig('openai', { apiKey: '', enabled: true })

      expect(useAIStore.getState().activeProviders).not.toContain('openai')
    })

    it('should include provider in activeProviders if baseUrl is set even without apiKey', () => {
      useAIStore.getState().updateConfig('llama', { baseUrl: 'http://localhost:11434', enabled: true })

      expect(useAIStore.getState().activeProviders).toContain('llama')
    })

    it('should update model for a provider', () => {
      useAIStore.getState().updateConfig('anthropic', { model: 'claude-opus-4-20250514' })

      expect(useAIStore.getState().configs.anthropic.model).toBe('claude-opus-4-20250514')
    })

    it('should handle multiple providers being active', () => {
      useAIStore.getState().updateConfig('openai', { apiKey: 'sk-1', enabled: true })
      useAIStore.getState().updateConfig('anthropic', { apiKey: 'sk-2', enabled: true })

      expect(useAIStore.getState().activeProviders).toHaveLength(2)
      expect(useAIStore.getState().activeProviders).toContain('openai')
      expect(useAIStore.getState().activeProviders).toContain('anthropic')
    })
  })

  // ── Custom Models ──

  describe('addCustomModel', () => {
    it('should add a custom model to a provider', () => {
      useAIStore.getState().addCustomModel('openai', 'gpt-4-turbo')

      expect(useAIStore.getState().customModels.openai).toContain('gpt-4-turbo')
    })

    it('should not add duplicate models', () => {
      useAIStore.getState().addCustomModel('openai', 'gpt-4-turbo')
      useAIStore.getState().addCustomModel('openai', 'gpt-4-turbo')

      expect(useAIStore.getState().customModels.openai).toHaveLength(1)
    })
  })

  describe('removeCustomModel', () => {
    it('should remove a custom model from a provider', () => {
      useAIStore.getState().addCustomModel('openai', 'gpt-4-turbo')
      useAIStore.getState().addCustomModel('openai', 'gpt-4o')

      useAIStore.getState().removeCustomModel('openai', 'gpt-4-turbo')

      expect(useAIStore.getState().customModels.openai).toEqual(['gpt-4o'])
    })
  })

  // ── Chat Messages ──

  describe('sendMessage', () => {
    it('should add a user message to the store', async () => {
      useAIStore.getState().updateConfig('openai', { apiKey: 'sk-test', enabled: true })

      await useAIStore.getState().sendMessage('Hello')

      const messages = useAIStore.getState().messages
      expect(messages).toHaveLength(2) // user + placeholder assistant
      expect(messages[0].role).toBe('user')
      expect(messages[0].content).toBe('Hello')
      expect(messages[1].role).toBe('assistant')
    })

    it('should not add any message if no active providers', async () => {
      await useAIStore.getState().sendMessage('Hello')
      expect(useAIStore.getState().messages).toHaveLength(0)
    })
  })

  describe('clearMessages', () => {
    it('should clear all messages and triple messages', async () => {
      useAIStore.getState().updateConfig('openai', { apiKey: 'sk-test', enabled: true })
      await useAIStore.getState().sendMessage('Test')
      expect(useAIStore.getState().messages.length).toBeGreaterThan(0)

      useAIStore.getState().clearMessages()

      expect(useAIStore.getState().messages).toEqual([])
      expect(useAIStore.getState().tripleMessages).toEqual({
        openai: [], anthropic: [], gemini: [], llama: [], grok: [],
      })
    })
  })

  // ── Triple Mode ──

  describe('setTripleMode', () => {
    it('should set triple mode', () => {
      useAIStore.getState().setTripleMode(true)
      expect(useAIStore.getState().tripleMode).toBe(true)

      useAIStore.getState().setTripleMode(false)
      expect(useAIStore.getState().tripleMode).toBe(false)
    })
  })

  // ── Context Injection ──

  describe('setContextInjection', () => {
    it('should set context injection mode', () => {
      useAIStore.getState().setContextInjection('always')
      expect(useAIStore.getState().contextInjection).toBe('always')

      useAIStore.getState().setContextInjection('never')
      expect(useAIStore.getState().contextInjection).toBe('never')

      useAIStore.getState().setContextInjection('ask')
      expect(useAIStore.getState().contextInjection).toBe('ask')
    })
  })

  // ── Conversations ──

  describe('loadConversations', () => {
    it('should load conversations from the adapter', async () => {
      const convs = [
        { id: 'conv1', projectId: 'p1', title: 'Chat 1', messages: [], createdAt: 1 },
      ]
      mockAdapter.fetchConversations.mockResolvedValueOnce(convs)

      await useAIStore.getState().loadConversations('p1')

      expect(mockAdapter.fetchConversations).toHaveBeenCalledWith('p1')
      expect(useAIStore.getState().conversations).toEqual(convs)
    })
  })

  describe('createConversation', () => {
    it('should create a conversation with default title', async () => {
      const conv = await useAIStore.getState().createConversation('p1')

      expect(conv.id).toBe('test-id-1')
      expect(conv.projectId).toBe('p1')
      expect(conv.title).toBe('\uc0c8 \ub300\ud654') // '새 대화'
      expect(conv.messages).toEqual([])
      expect(conv.createdAt).toBe(1700000000000)
      expect(mockAdapter.insertConversation).toHaveBeenCalledTimes(1)
      expect(useAIStore.getState().conversations).toHaveLength(1)
      expect(useAIStore.getState().currentConversationId).toBe('test-id-1')
      expect(useAIStore.getState().messages).toEqual([])
    })

    it('should create a conversation with custom title', async () => {
      const conv = await useAIStore.getState().createConversation('p1', 'My Chat')

      expect(conv.title).toBe('My Chat')
    })

    it('should prepend new conversation', async () => {
      await useAIStore.getState().createConversation('p1', 'First')
      await useAIStore.getState().createConversation('p1', 'Second')

      const convs = useAIStore.getState().conversations
      expect(convs[0].title).toBe('Second')
      expect(convs[1].title).toBe('First')
    })
  })

  describe('selectConversation', () => {
    it('should set current conversation and load messages', async () => {
      const msgs = [
        { id: 'm1', role: 'user', content: 'Hello', timestamp: 1 },
        { id: 'm2', role: 'assistant', content: 'Hi', timestamp: 2 },
      ]
      mockAdapter.fetchMessages.mockResolvedValueOnce(msgs)

      await useAIStore.getState().selectConversation('conv1')

      expect(useAIStore.getState().currentConversationId).toBe('conv1')
      expect(mockAdapter.fetchMessages).toHaveBeenCalledWith('conv1')
      expect(useAIStore.getState().messages).toEqual(msgs)
    })
  })

  describe('renameConversation', () => {
    it('should rename a conversation', async () => {
      await useAIStore.getState().createConversation('p1', 'Old Title')

      await useAIStore.getState().renameConversation('test-id-1', 'New Title')

      expect(mockAdapter.updateConversation).toHaveBeenCalledWith('test-id-1', { title: 'New Title' })
      expect(useAIStore.getState().conversations[0].title).toBe('New Title')
    })
  })

  describe('deleteConversation', () => {
    it('should delete a conversation', async () => {
      await useAIStore.getState().createConversation('p1', 'Chat')

      await useAIStore.getState().deleteConversation('test-id-1')

      expect(mockAdapter.deleteConversation).toHaveBeenCalledWith('test-id-1')
      expect(useAIStore.getState().conversations).toHaveLength(0)
    })

    it('should clear currentConversationId and messages if current was deleted', async () => {
      await useAIStore.getState().createConversation('p1', 'Chat')
      expect(useAIStore.getState().currentConversationId).toBe('test-id-1')

      await useAIStore.getState().deleteConversation('test-id-1')

      expect(useAIStore.getState().currentConversationId).toBeNull()
      expect(useAIStore.getState().messages).toEqual([])
    })

    it('should not clear currentConversationId if a different conversation was deleted', async () => {
      await useAIStore.getState().createConversation('p1', 'Chat 1')
      await useAIStore.getState().createConversation('p1', 'Chat 2')

      // currentConversationId is now test-id-2 (from the second create)
      expect(useAIStore.getState().currentConversationId).toBe('test-id-2')

      await useAIStore.getState().deleteConversation('test-id-1')

      expect(useAIStore.getState().currentConversationId).toBe('test-id-2')
    })
  })

  // ── Prompt Templates ──

  describe('addTemplate', () => {
    it('should add a prompt template with generated id', () => {
      useAIStore.getState().addTemplate({
        name: 'My Template',
        prompt: 'Analyze this: {text}',
        category: 'custom',
      })

      const templates = useAIStore.getState().promptTemplates
      const added = templates.find(t => t.name === 'My Template')
      expect(added).toBeDefined()
      expect(added!.id).toBe('test-id-1')
      expect(added!.prompt).toBe('Analyze this: {text}')
      expect(added!.category).toBe('custom')
    })
  })

  describe('deleteTemplate', () => {
    it('should remove a prompt template by id', () => {
      // Add a custom template
      useAIStore.getState().addTemplate({
        name: 'To Delete',
        prompt: 'test',
        category: 'custom',
      })

      // Verify it was added
      const addedTemplate = useAIStore.getState().promptTemplates.find(t => t.name === 'To Delete')
      expect(addedTemplate).toBeDefined()
      const templateId = addedTemplate!.id

      // Delete it
      useAIStore.getState().deleteTemplate(templateId)

      // Verify it was removed
      const afterDelete = useAIStore.getState().promptTemplates
      expect(afterDelete.find(t => t.id === templateId)).toBeUndefined()
      expect(afterDelete.find(t => t.name === 'To Delete')).toBeUndefined()
    })

    it('should not affect other templates when deleting', () => {
      // Add two custom templates
      useAIStore.getState().addTemplate({ name: 'Keep Me', prompt: 'keep', category: 'custom' })
      useAIStore.getState().addTemplate({ name: 'Delete Me', prompt: 'delete', category: 'custom' })

      const deleteTarget = useAIStore.getState().promptTemplates.find(t => t.name === 'Delete Me')!
      const keepTarget = useAIStore.getState().promptTemplates.find(t => t.name === 'Keep Me')!

      useAIStore.getState().deleteTemplate(deleteTarget.id)

      expect(useAIStore.getState().promptTemplates.find(t => t.id === keepTarget.id)).toBeDefined()
      expect(useAIStore.getState().promptTemplates.find(t => t.id === deleteTarget.id)).toBeUndefined()
    })
  })

  // ── Default Templates ──

  describe('default templates', () => {
    it('should have default templates loaded', () => {
      const templates = useAIStore.getState().promptTemplates
      expect(templates.length).toBeGreaterThan(0)
      // Check that templates exist with known categories
      expect(templates.some(t => t.category === 'writing')).toBe(true)
      expect(templates.some(t => t.category === 'analysis')).toBe(true)
    })
  })

  // ── Default Config State ──

  describe('default state', () => {
    it('should have all five providers configured', () => {
      const configs = useAIStore.getState().configs
      const providers: AIProvider[] = ['openai', 'anthropic', 'gemini', 'llama', 'grok']
      for (const p of providers) {
        expect(configs[p]).toBeDefined()
        expect(configs[p].provider).toBe(p)
        expect(configs[p].enabled).toBe(false)
      }
    })

    it('should have no active providers by default', () => {
      expect(useAIStore.getState().activeProviders).toHaveLength(0)
    })

    it('should have contextInjection set to ask by default', () => {
      expect(useAIStore.getState().contextInjection).toBe('ask')
    })

    it('should have tripleMode off by default', () => {
      expect(useAIStore.getState().tripleMode).toBe(false)
    })
  })

  // ── sendMessage with conversationId ──

  describe('sendMessage with conversationId', () => {
    it('should call insertMessage for user message when conversationId is set', async () => {
      useAIStore.getState().updateConfig('openai', { apiKey: 'sk-test', enabled: true })
      await useAIStore.getState().createConversation('p1', 'Test Chat')

      const convId = useAIStore.getState().currentConversationId!
      expect(convId).toBeTruthy()

      await useAIStore.getState().sendMessage('Hello with conv')

      // insertMessage should be called at least once for the user message
      expect(mockAdapter.insertMessage).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'user', content: 'Hello with conv', conversationId: convId }),
      )
    })

    it('should persist assistant response when conversationId is set', async () => {
      useAIStore.getState().updateConfig('openai', { apiKey: 'sk-test', enabled: true })
      await useAIStore.getState().createConversation('p1', 'Test Chat')

      await useAIStore.getState().sendMessage('Hello')

      // insertMessage should be called for both user and assistant messages
      const calls = mockAdapter.insertMessage.mock.calls.map((c: [{ role: string }]) => c[0].role)
      expect(calls).toContain('user')
      expect(calls).toContain('assistant')
    })
  })
})
