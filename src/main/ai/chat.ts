import { getDb } from '../db/connection'
import { v4 as uuid } from 'uuid'
import * as settingsDb from '../db/settings'
import * as memoryDb from '../db/memory'
import * as itemsDb from '../db/items'
import * as actionStepsDb from '../db/action-steps'
import * as ollamaClient from './ollama-client'
import type { ChatMessage, PendingAction, Sector, Item, ItemStatus } from '../../preload/types'

const OLLAMA_BASE_URL = 'http://127.0.0.1:11434'

export function normalizeActionSteps(
  rawSteps: any, 
  fallbackPrompt?: string, 
  fallbackNotes?: string
): { content: string; effort_value?: number; effort_unit?: string }[] {
  let steps: any = rawSteps
  if (typeof steps === 'string') {
    try {
      steps = JSON.parse(steps)
    } catch {
      steps = steps.split(/\n|,|;/).map((s: string) => s.trim()).filter(Boolean)
    }
  }

  let result: { content: string; effort_value?: number; effort_unit?: string }[] = []

  if (Array.isArray(steps) && steps.length > 0) {
    result = steps.map((s: any) => {
      if (typeof s === 'string') {
        const cleaned = s.replace(/^(\d+[\.\)\-]|[-*•])\s*/, '').trim()
        return cleaned ? { content: cleaned } : null
      }
      if (s && typeof s === 'object') {
        const content = String(s.content || s.text || s.title || s.step || '').replace(/^(\d+[\.\)\-]|[-*•])\s*/, '').trim()
        if (!content) return null
        return {
          content,
          effort_value: s.effort_value ? Number(s.effort_value) : undefined,
          effort_unit: s.effort_unit ? String(s.effort_unit).trim() : undefined
        }
      }
      return null
    }).filter(Boolean) as { content: string; effort_value?: number; effort_unit?: string }[]
  }

  // Fallback 1: Extract from notes if notes is a numbered/bullet list
  if (result.length === 0 && fallbackNotes && typeof fallbackNotes === 'string') {
    const lines = fallbackNotes.split('\n').map(l => l.trim()).filter(Boolean)
    const listLines = lines.filter(l => /^\d+[\.\)\-]/.test(l) || /^[-*•]/.test(l))
    if (listLines.length > 0) {
      result = listLines.map(l => ({ content: l.replace(/^(\d+[\.\)\-]|[-*•])\s*/, '').trim() }))
    }
  }

  // Fallback 2: Extract from user prompt if prompt has "with next steps as / with steps as"
  if (result.length === 0 && fallbackPrompt && typeof fallbackPrompt === 'string') {
    const stepMatch = fallbackPrompt.match(/with (?:next )?steps (?:as|being|of|include|including) (.+)$/i)
    if (stepMatch && stepMatch[1]) {
      const stepParts = stepMatch[1]
        .split(/\s+(?:and )?next (?:being|step is|step as|as)?\s+|\s*,\s*and\s+|\s*,\s*|\s*;\s*|\n+/i)
        .map(s => s.replace(/^(?:and )?(?:next being|next step is|next is|next as)?\s*/i, '').trim())
        .filter(s => s.length > 2)
      if (stepParts.length > 0) {
        result = stepParts.map(s => ({ content: s }))
      }
    }
  }

  return result
}

export function extractJsonBlock(text: string): { jsonStr: string; startIndex: number; endIndex: number } | null {
  const startIdx = text.indexOf('{')
  if (startIdx === -1) return null

  let depth = 0
  let inString = false
  let escape = false
  let endIdx = -1

  for (let i = startIdx; i < text.length; i++) {
    const char = text[i]

    if (escape) {
      escape = false
      continue
    }

    if (char === '\\') {
      escape = true
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (!inString) {
      if (char === '{') {
        depth++
      } else if (char === '}') {
        depth--
        if (depth === 0) {
          endIdx = i + 1
          break
        }
      }
    }
  }

  if (endIdx !== -1) {
    return {
      jsonStr: text.slice(startIdx, endIdx),
      startIndex: startIdx,
      endIndex: endIdx
    }
  }

  return {
    jsonStr: text.slice(startIdx),
    startIndex: startIdx,
    endIndex: text.length
  }
}

export function sanitizeAssistantMessage(content: string, hasPendingActions: boolean): string {
  if (!content) {
    return hasPendingActions ? 'I have prepared the requested action for your confirmation below:' : ''
  }

  let cleaned = content.replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '').trim()

  while (true) {
    const block = extractJsonBlock(cleaned)
    if (!block) break
    const { jsonStr, startIndex, endIndex } = block
    if (
      jsonStr.includes('"name"') ||
      jsonStr.includes('"function"') ||
      jsonStr.includes('"tool_name"') ||
      jsonStr.includes('"parameters"') ||
      jsonStr.includes('"action_steps"') ||
      jsonStr.includes('"items_create"') ||
      jsonStr.includes('"items_update"') ||
      jsonStr.includes('"action_steps_create"')
    ) {
      cleaned = (cleaned.slice(0, startIndex) + cleaned.slice(endIndex)).trim()
    } else {
      break
    }
  }

  cleaned = cleaned.replace(/```(?:json)?\s*```/g, '').trim()

  if (!cleaned && hasPendingActions) {
    return 'I have prepared the requested action for your confirmation below:'
  }

  return cleaned
}

const TOOLS_SCHEMA = [
  {
    type: 'function',
    function: {
      name: 'items_create',
      description: 'Propose creating a new item/task in the user\'s Life Stack, optionally with next action steps (checklist items). This creates a pending diff card for user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The concise, clear title of the task (e.g. "Masters Plan in Ireland")' },
          sector_id: { type: 'string', description: 'The exact ID or exact name of the sector this item belongs to' },
          action_steps: {
            type: 'array',
            description: 'Ordered list of next action steps (checklist subtasks). Whenever the user provides next steps or milestones, put them here instead of in notes.',
            items: {
              type: 'object',
              properties: {
                content: { type: 'string', description: 'The discrete next step description (e.g. "Talk to 6 consultancies")' },
                effort_value: { type: 'number', description: 'Optional estimated effort number (e.g. 1, 2, 30)' },
                effort_unit: { type: 'string', enum: ['min', 'hr', 'day', 'minutes', 'hours', 'days'], description: 'Optional effort unit' }
              },
              required: ['content']
            }
          },
          notes: { type: 'string', description: 'Optional background context or reference information. Do NOT put actionable steps or checklists here.' },
          status: { type: 'string', enum: ['active', 'paused', 'blocked', 'done', 'queued'], description: 'Initial status (default: queued or active)' }
        },
        required: ['title', 'sector_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'action_steps_create',
      description: 'Propose adding new action steps (checklist items) to an existing item.',
      parameters: {
        type: 'object',
        properties: {
          item_id: { type: 'string', description: 'The exact ID of the item to add steps to' },
          steps: {
            type: 'array',
            description: 'List of next action steps to add',
            items: {
              type: 'object',
              properties: {
                content: { type: 'string', description: 'Step description' },
                effort_value: { type: 'number', description: 'Optional estimated effort amount' },
                effort_unit: { type: 'string', description: 'Optional effort unit (min, hr, day)' }
              },
              required: ['content']
            }
          }
        },
        required: ['item_id', 'steps']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'items_update',
      description: 'Propose updating an existing item\'s status, progress, or notes. This creates a pending diff card for user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The exact ID of the item to update' },
          status: { type: 'string', enum: ['active', 'paused', 'blocked', 'done', 'queued'], description: 'New status for the item' },
          progress: { type: 'number', description: 'Progress percentage (0 to 100)' },
          notes: { type: 'string', description: 'Updated notes text' }
        },
        required: ['id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'memory_search',
      description: 'Search the user\'s Life Stack items, notes, action steps, and memory vectors for relevant context or answers.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query or concept to look up' },
          topK: { type: 'number', description: 'Number of top results to return (default: 8)' }
        },
        required: ['query']
      }
    }
  }
]

function getSystemPrompt(): string {
  const db = getDb()
  const sectors = db.prepare('SELECT id, name, icon, color FROM sectors ORDER BY sort_order ASC').all() as Sector[]
  const items = db.prepare('SELECT id, title, sector_id, status, progress, priority_rank, updated_at FROM items WHERE status != \'done\' ORDER BY priority_rank ASC').all() as (Item & { updated_at: string })[]
  const focusLimit = settingsDb.get<number>('focus_limit') ?? 5

  const sectorCounts: Record<string, number> = {}
  sectors.forEach(s => { sectorCounts[s.id] = 0 })
  items.forEach(i => {
    if (sectorCounts[i.sector_id] !== undefined) {
      sectorCounts[i.sector_id]++
    }
  })

  const sectorSummary = sectors.map(s => `- Sector "${s.name}" (ID: ${s.id}, Icon: ${s.icon || '📁'}, Items: ${sectorCounts[s.id] || 0})`).join('\n')
  const topActiveItems = items.filter(i => i.status === 'active').slice(0, 8).map(i => {
    const s = sectors.find(sec => sec.id === i.sector_id)
    return `  #${i.priority_rank} [${s ? s.name : 'Unknown'}] ${i.title} (${i.progress}%, status: ${i.status}) [ID: ${i.id}]`
  }).join('\n')

  return `You are LifeStack Assistant, a concise, active-voice productivity assistant embedded in LifeStack.
You help the user manage their unified life stack and tasks following Simplified Technical English (ASD-STE100): clear, concise, direct.

CURRENT STACK STATE:
Focus Limit: ${focusLimit}
Available Sectors:
${sectorSummary}

Top Active Items:
${topActiveItems || '  (No active items)'}

GUIDELINES:
1. When creating a task:
   - Call the tool \`items_create\`.
   - ALWAYS provide a concise, descriptive 'title' (e.g. "Masters Plan in Ireland"). Never leave 'title' empty.
   - Select the most appropriate sector_id from the Available Sectors list (e.g. for masters/degrees/study choose Learning; for work choose Career; for health choose Health).
   - If the user lists steps/subtasks/milestones (e.g. "with next steps as..."), place each discrete step into the \`action_steps\` array: \`[{ content: "Talking to 6 consultancies" }, { content: "Listing valid unis" }, ...]\`.
   - NEVER place next steps or checklist items into 'notes'.
2. When the user asks to add next steps to an existing task:
   - Call the tool \`action_steps_create\` with \`item_id\` and \`steps\` array.
3. When the user asks to update an item (e.g. mark done, set progress, change status, update notes):
   - Call the tool \`items_update\` with the exact item ID.
4. When the user asks a question about their tasks, what they need to do, or what is stale/due:
   - Call \`memory_search\` to inspect real tasks and context before answering.
5. Keep conversational messages concise, clear, and direct.
6. All item and step creations create pending action diff cards that require the user's explicit confirmation.
`
}

export function listMessages(): ChatMessage[] {
  const db = getDb()
  return db.prepare('SELECT id, role, content, tool_calls, created_at FROM chat_messages ORDER BY created_at ASC').all() as ChatMessage[]
}

export function listPendingActions(): PendingAction[] {
  const db = getDb()
  return db.prepare('SELECT id, message_id, tool_name, arguments, status, resolved_at FROM pending_actions ORDER BY resolved_at DESC, id DESC').all() as PendingAction[]
}

export function clearHistory(): void {
  const db = getDb()
  db.transaction(() => {
    db.prepare('DELETE FROM pending_actions').run()
    db.prepare('DELETE FROM chat_messages').run()
  })()
}

export async function acceptAction(actionId: string, overrides?: Record<string, any>): Promise<{ success: boolean; error?: string }> {
  const db = getDb()
  const action = db.prepare('SELECT * FROM pending_actions WHERE id = ?').get(actionId) as PendingAction | undefined
  if (!action) return { success: false, error: 'Action not found' }
  if (action.status !== 'pending') return { success: false, error: `Action is already ${action.status}` }

  let parsedArgs: Record<string, any> = {}
  try {
    parsedArgs = JSON.parse(action.arguments)
  } catch (e: any) {
    return { success: false, error: 'Malformed action arguments' }
  }

  const finalArgs = { ...parsedArgs, ...(overrides || {}) }

  try {
    if (action.tool_name === 'items_create' || action.tool_name === 'items:create') {
      if (!finalArgs.title || typeof finalArgs.title !== 'string') {
        return { success: false, error: 'Missing title' }
      }
      if (!finalArgs.sector_id || typeof finalArgs.sector_id !== 'string') {
        return { success: false, error: 'Missing sector_id' }
      }
      const newItem = itemsDb.createItem({
        title: finalArgs.title.trim(),
        sector_id: finalArgs.sector_id,
        notes: finalArgs.notes || '',
        status: finalArgs.status || 'queued'
      })

      // Normalize and create action steps
      const stepsToCreate = normalizeActionSteps(finalArgs.action_steps || finalArgs.steps)
      for (const step of stepsToCreate) {
        actionStepsDb.createStep(newItem.id, step.content, {
          effort_value: step.effort_value,
          effort_unit: step.effort_unit
        })
      }
    } else if (action.tool_name === 'action_steps_create' || action.tool_name === 'action_steps:create') {
      if (!finalArgs.item_id) {
        return { success: false, error: 'Missing item_id' }
      }
      const stepsToCreate = normalizeActionSteps(finalArgs.steps || finalArgs.action_steps)
      for (const step of stepsToCreate) {
        actionStepsDb.createStep(finalArgs.item_id, step.content, {
          effort_value: step.effort_value,
          effort_unit: step.effort_unit
        })
      }
    } else if (action.tool_name === 'items_update' || action.tool_name === 'items:update') {
      if (!finalArgs.id) {
        return { success: false, error: 'Missing item ID' }
      }
      const changes: any = {}
      if (finalArgs.status !== undefined) changes.status = finalArgs.status
      if (finalArgs.progress !== undefined) changes.progress = Number(finalArgs.progress)
      if (finalArgs.notes !== undefined) changes.notes = finalArgs.notes
      if (finalArgs.title !== undefined) changes.title = finalArgs.title
      if (finalArgs.sector_id !== undefined) changes.sector_id = finalArgs.sector_id

      itemsDb.updateItem(finalArgs.id, changes)
    }

    const now = new Date().toISOString()
    db.prepare('UPDATE pending_actions SET status = \'accepted\', resolved_at = ? WHERE id = ?').run(now, actionId)
    return { success: true }
  } catch (err: any) {
    console.error('[Accept Action Error]:', err)
    return { success: false, error: err?.message || String(err) }
  }
}

export function rejectAction(actionId: string): { success: boolean } {
  const db = getDb()
  const now = new Date().toISOString()
  db.prepare('UPDATE pending_actions SET status = \'rejected\', resolved_at = ? WHERE id = ?').run(now, actionId)
  return { success: true }
}

export async function sendMessage(userContent: string): Promise<{ assistantMessage: ChatMessage; pendingActions: PendingAction[]; error?: string }> {
  if (!userContent || userContent.trim().length === 0) {
    throw new Error('Message content cannot be empty')
  }

  const db = getDb()
  const now = new Date().toISOString()
  const userMessageId = uuid()

  // 1. Save user message to database
  try {
    db.prepare(`
      INSERT INTO chat_messages (id, role, content, created_at)
      VALUES (?, 'user', ?, ?)
    `).run(userMessageId, userContent.trim(), now)
  } catch (dbErr: any) {
    console.error('[Chat DB Error - User Insert]:', dbErr)
    throw new Error(`Failed to record user message: ${dbErr?.message || dbErr}`)
  }

  // 2. Fetch existing history (last 12 messages)
  const history = db.prepare(`
    SELECT role, content, tool_calls FROM chat_messages 
    ORDER BY created_at DESC LIMIT 12
  `).all() as { role: string; content: string; tool_calls?: string }[]
  history.reverse()

  const systemPrompt = getSystemPrompt()
  const preferredModel = settingsDb.get<string>('chat_model') || 'qwen2.5:3b'
  const model = await ollamaClient.getBestChatModel(preferredModel)

  const formattedMessages: any[] = [
    { role: 'system', content: systemPrompt }
  ]

  for (const h of history) {
    formattedMessages.push({
      role: h.role,
      content: h.content
    })
  }

  let assistantMsg: { role: string; content: string; tool_calls?: any[] } = { role: 'assistant', content: '' }

  // 3. Call Ollama Chat endpoint with tools (60s timeout, keep_alive: "30m")
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: formattedMessages,
        tools: TOOLS_SCHEMA,
        stream: false,
        keep_alive: '30m'
      }),
      signal: controller.signal
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      const errMsg = `Ollama returned HTTP ${response.status}: ${errorText || response.statusText}`
      ollamaClient.setLastError(errMsg)
      
      const assistantMsgId = uuid()
      const fallbackMessage: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: `Could not complete request with model '${model}': ${errMsg}`,
        created_at: new Date().toISOString()
      }
      db.prepare('INSERT INTO chat_messages (id, role, content, created_at) VALUES (?, ?, ?, ?)').run(
        assistantMsgId, fallbackMessage.role, fallbackMessage.content, fallbackMessage.created_at
      )
      return { assistantMessage: fallbackMessage, pendingActions: [], error: errMsg }
    }

    const data = await response.json() as { message?: { role: string; content: string; tool_calls?: any[] } }
    if (data.message) {
      assistantMsg = data.message
    }
  } catch (netErr: any) {
    console.error('[Chat Ollama Network Error]:', netErr)
    const errMsg = netErr?.name === 'AbortError' ? 'Ollama request timed out after 60s' : (netErr?.message || String(netErr))
    ollamaClient.setLastError(`Ollama connection error: ${errMsg}`)

    const assistantMsgId = uuid()
    const errorAssistantMessage: ChatMessage = {
      id: assistantMsgId,
      role: 'assistant',
      content: `I could not communicate with Ollama (${errMsg}). Please verify that Ollama is running on http://127.0.0.1:11434 and model '${model}' is ready.`,
      created_at: new Date().toISOString()
    }
    try {
      db.prepare('INSERT INTO chat_messages (id, role, content, created_at) VALUES (?, ?, ?, ?)').run(
        assistantMsgId, errorAssistantMessage.role, errorAssistantMessage.content, errorAssistantMessage.created_at
      )
    } catch {}
    return { assistantMessage: errorAssistantMessage, pendingActions: [], error: errMsg }
  }

  // 4. Handle memory_search tool calls (Multi-turn retrieval)
  if (Array.isArray(assistantMsg.tool_calls) && assistantMsg.tool_calls.some(tc => tc.function?.name === 'memory_search')) {
    const searchCall = assistantMsg.tool_calls.find(tc => tc.function?.name === 'memory_search')
    let query = ''
    let topK = 8
    try {
      const args = typeof searchCall.function.arguments === 'string' ? JSON.parse(searchCall.function.arguments) : searchCall.function.arguments
      query = args.query || userContent
      if (args.topK) topK = Number(args.topK)
    } catch {
      query = userContent
    }

    console.log(`[Chat Tool] Executing memory_search for: "${query}" (topK: ${topK})`)
    const searchResults = await memoryDb.search(query, topK)
    
    const formattedResults = searchResults.length > 0 
      ? searchResults.map(r => `- [${r.item_status || 'item'}] ${r.item_title || 'Untitled'}: ${r.content.replace(/\n/g, ' ')} (distance: ${r.distance.toFixed(2)})`).join('\n')
      : 'No relevant items found in memory.'

    formattedMessages.push(assistantMsg)
    formattedMessages.push({
      role: 'tool',
      content: `Search Results for "${query}":\n${formattedResults}`
    })

    // Second turn with search results
    try {
      const followUpRes = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: formattedMessages,
          tools: TOOLS_SCHEMA,
          stream: false,
          keep_alive: '30m'
        })
      })

      if (followUpRes.ok) {
        const followUpData = await followUpRes.json() as { message?: { role: string; content: string; tool_calls?: any[] } }
        if (followUpData.message) {
          assistantMsg = followUpData.message
        }
      }
    } catch (followUpErr: any) {
      console.error('[Chat FollowUp Error]:', followUpErr)
    }
  }

  // 5. Parse and validate mutating tool calls (items_create, action_steps_create, items_update)
  const assistantMsgId = uuid()
  const pendingActions: PendingAction[] = []
  const validationErrors: string[] = []

  const sectors = db.prepare('SELECT id, name FROM sectors').all() as { id: string; name: string }[]
  const items = db.prepare('SELECT id, title FROM items').all() as { id: string; title: string }[]

  // If assistantMsg.tool_calls is empty, check if assistantMsg.content contains a JSON tool call
  if ((!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0) && assistantMsg.content) {
    const jsonBlock = extractJsonBlock(assistantMsg.content)
    if (jsonBlock) {
      let rawJson = jsonBlock.jsonStr
      // Fix unvalued keys like "effort_value":} -> "effort_value":null}
      rawJson = rawJson.replace(/:\s*([,}])/g, ':null$1').replace(/,\s*([}\]])/g, '$1')
      try {
        const parsed = JSON.parse(rawJson)
        const name = parsed.name || parsed.function?.name || parsed.tool_name
        const args = parsed.parameters || parsed.arguments || parsed.function?.arguments || {}
        if (name) {
          assistantMsg.tool_calls = [{
            id: uuid(),
            type: 'function',
            function: {
              name,
              arguments: typeof args === 'string' ? args : JSON.stringify(args)
            }
          }]
        }
      } catch (parseErr) {
        console.warn('[Chat] Could not parse text-embedded tool call JSON:', parseErr)
      }
    }
  }

  if (Array.isArray(assistantMsg.tool_calls) && assistantMsg.tool_calls.length > 0) {
    for (const tc of assistantMsg.tool_calls) {
      const toolName = tc.function?.name
      let rawArgs: any = {}
      try {
        rawArgs = typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : (tc.function?.arguments || {})
      } catch {
        validationErrors.push(`Malformed arguments for tool ${toolName}`)
        continue
      }

      if (toolName === 'items_create') {
        if (!rawArgs.title || typeof rawArgs.title !== 'string' || !rawArgs.title.trim()) {
          const promptMatch = userContent.match(/(?:create|add|new)\s+(?:an?\s+)?(?:item|task)(?: for)? (?:my )?([^,\n]+?)(?: with next steps| with steps| in [A-Z]|$)/i)
          if (promptMatch && promptMatch[1]?.trim()) {
            rawArgs.title = promptMatch[1].trim()
          } else {
            rawArgs.title = userContent.slice(0, 50).trim()
          }
        }

        let targetSectorId = rawArgs.sector_id || sectors[0]?.id
        const directMatch = sectors.find(s => s.id === targetSectorId)
        if (!directMatch) {
          const nameMatch = sectors.find(s => s.name.toLowerCase() === String(targetSectorId).toLowerCase())
          if (nameMatch) {
            targetSectorId = nameMatch.id
          } else {
            // Intelligent sector matching based on content (e.g. masters/degree -> Learning)
            const lowerPrompt = userContent.toLowerCase()
            const foundSector = sectors.find(s => lowerPrompt.includes(s.name.toLowerCase())) ||
                                (lowerPrompt.includes('master') || lowerPrompt.includes('uni') || lowerPrompt.includes('study') ? sectors.find(s => s.name.toLowerCase() === 'learning') : null) ||
                                sectors[0]
            targetSectorId = foundSector ? foundSector.id : sectors[0]?.id
          }
        }

        rawArgs.sector_id = targetSectorId
        rawArgs.title = rawArgs.title.trim()

        // Robust Action Steps extraction
        const normalizedSteps = normalizeActionSteps(rawArgs.action_steps, userContent, rawArgs.notes)
        rawArgs.action_steps = normalizedSteps

        // If notes was just the steps, clear it
        if (rawArgs.notes && normalizedSteps.length > 0) {
          const lines = String(rawArgs.notes).split('\n').map(l => l.trim()).filter(Boolean)
          if (lines.length > 0 && lines.every(l => /^\d+[\.\)\-]/.test(l) || /^[-*•]/.test(l))) {
            rawArgs.notes = ''
          }
        }

        const actionId = uuid()
        const actionRow: PendingAction = {
          id: actionId,
          message_id: assistantMsgId,
          tool_name: 'items:create',
          arguments: JSON.stringify(rawArgs),
          status: 'pending',
          resolved_at: null
        }
        pendingActions.push(actionRow)
      } else if (toolName === 'action_steps_create') {
        if (!rawArgs.item_id || !items.some(i => i.id === rawArgs.item_id)) {
          const titleMatch = items.find(i => i.title.toLowerCase() === String(rawArgs.item_id).toLowerCase())
          if (titleMatch) {
            rawArgs.item_id = titleMatch.id
          } else {
            validationErrors.push(`Item ID "${rawArgs.item_id}" not found in stack.`)
            continue
          }
        }

        const normalizedSteps = normalizeActionSteps(rawArgs.steps || rawArgs.action_steps, userContent, '')
        if (normalizedSteps.length === 0) {
          validationErrors.push('No valid action steps provided.')
          continue
        }
        rawArgs.steps = normalizedSteps

        const actionId = uuid()
        const actionRow: PendingAction = {
          id: actionId,
          message_id: assistantMsgId,
          tool_name: 'action_steps:create',
          arguments: JSON.stringify(rawArgs),
          status: 'pending',
          resolved_at: null
        }
        pendingActions.push(actionRow)
      } else if (toolName === 'items_update') {
        if (!rawArgs.id || !items.some(i => i.id === rawArgs.id)) {
          const titleMatch = items.find(i => i.title.toLowerCase() === String(rawArgs.id).toLowerCase())
          if (titleMatch) {
            rawArgs.id = titleMatch.id
          } else {
            validationErrors.push(`Item ID "${rawArgs.id}" not found in stack.`)
            continue
          }
        }

        if (rawArgs.progress !== undefined) {
          const p = Number(rawArgs.progress)
          if (isNaN(p) || p < 0 || p > 100) {
            validationErrors.push(`Progress value (${rawArgs.progress}) must be between 0 and 100.`)
            continue
          }
          rawArgs.progress = p
        }

        if (rawArgs.status !== undefined) {
          const validStatuses: ItemStatus[] = ['active', 'paused', 'blocked', 'done', 'queued']
          if (!validStatuses.includes(rawArgs.status)) {
            validationErrors.push(`Status "${rawArgs.status}" is invalid. Valid: ${validStatuses.join(', ')}`)
            continue
          }
        }

        const actionId = uuid()
        const actionRow: PendingAction = {
          id: actionId,
          message_id: assistantMsgId,
          tool_name: 'items:update',
          arguments: JSON.stringify(rawArgs),
          status: 'pending',
          resolved_at: null
        }
        pendingActions.push(actionRow)
      }
    }
  }

  // Fallback: If no tool call was emitted but user has clear creation intent
  if (pendingActions.length === 0 && (!assistantMsg.tool_calls || assistantMsg.tool_calls.length === 0)) {
    const createIntent = userContent.match(/^(?:please\s+)?(?:create|add|new)\s+(?:an?\s+)?(?:item|task)\b/i)
    if (createIntent) {
      const promptMatch = userContent.match(/(?:create|add|new)\s+(?:an?\s+)?(?:item|task)(?: for)? (?:my )?([^,\n]+?)(?: with next steps| with steps| in [A-Z]|$)/i)
      const title = promptMatch && promptMatch[1]?.trim() ? promptMatch[1].trim() : userContent.slice(0, 50).trim()
      const lowerPrompt = userContent.toLowerCase()
      const foundSector = sectors.find(s => lowerPrompt.includes(s.name.toLowerCase())) ||
                          (lowerPrompt.includes('master') || lowerPrompt.includes('uni') || lowerPrompt.includes('study') ? sectors.find(s => s.name.toLowerCase() === 'learning') : null) ||
                          sectors[0]
      const steps = normalizeActionSteps([], userContent, '')
      const actionId = uuid()
      const actionRow: PendingAction = {
        id: actionId,
        message_id: assistantMsgId,
        tool_name: 'items:create',
        arguments: JSON.stringify({
          title,
          sector_id: foundSector ? foundSector.id : sectors[0]?.id,
          status: 'queued',
          action_steps: steps,
          notes: ''
        }),
        status: 'pending',
        resolved_at: null
      }
      pendingActions.push(actionRow)
    }
  }

  let finalContent = sanitizeAssistantMessage(assistantMsg.content || '', pendingActions.length > 0)
  if (validationErrors.length > 0) {
    finalContent += (finalContent ? '\n\n' : '') + `⚠️ **Validation Notice:**\n${validationErrors.map(e => `- ${e}`).join('\n')}`
  }

  const assistantCreatedAt = new Date().toISOString()
  const assistantMessage: ChatMessage = {
    id: assistantMsgId,
    role: 'assistant',
    content: finalContent,
    tool_calls: assistantMsg.tool_calls ? JSON.stringify(assistantMsg.tool_calls) : null,
    created_at: assistantCreatedAt
  }

  // 6. Atomic Transaction: Insert parent chat_messages FIRST, then children pending_actions SECOND
  try {
    db.transaction(() => {
      // 1. Insert chat_messages parent
      db.prepare(`
        INSERT INTO chat_messages (id, role, content, tool_calls, created_at)
        VALUES (?, 'assistant', ?, ?, ?)
      `).run(assistantMessage.id, assistantMessage.content, assistantMessage.tool_calls, assistantMessage.created_at)

      // 2. Insert pending_actions children referencing message_id
      const insertAction = db.prepare(`
        INSERT INTO pending_actions (id, message_id, tool_name, arguments, status, resolved_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      for (const action of pendingActions) {
        insertAction.run(action.id, action.message_id, action.tool_name, action.arguments, action.status, action.resolved_at)
      }
    })()
  } catch (dbErr: any) {
    console.error('[Chat DB Error - Assistant/Actions Insert]:', dbErr)
    const errText = `Database write error: ${dbErr?.message || dbErr}`
    return {
      assistantMessage: {
        id: assistantMsgId,
        role: 'assistant',
        content: `⚠️ Error saving action to database: ${errText}`,
        created_at: assistantCreatedAt
      },
      pendingActions: [],
      error: errText
    }
  }

  return {
    assistantMessage,
    pendingActions
  }
}
