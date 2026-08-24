import { getDb } from '../db/connection'
import { v4 as uuid } from 'uuid'
import * as settingsDb from '../db/settings'
import * as memoryDb from '../db/memory'
import * as itemsDb from '../db/items'
import * as exploreItemsDb from '../db/explore-items'
import * as nextItemsDb from '../db/next-items'
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

export function normalizeExploreTopics(
  rawTopics: any
): { title: string; notes: string; time_estimate_value?: number; time_estimate_unit?: string }[] {
  let topics: any = rawTopics
  if (typeof topics === 'string') {
    try {
      topics = JSON.parse(topics)
    } catch {
      topics = topics.split(/\n|,|;/).map((s: string) => s.trim()).filter(Boolean)
    }
  }

  if (!topics) return []
  const arr = Array.isArray(topics) ? topics : [topics]
  const results: { title: string; notes: string; time_estimate_value?: number; time_estimate_unit?: string }[] = []

  for (const e of arr) {
    if (typeof e === 'string') {
      const clean = e.replace(/^(\d+[\.\)\-]|[-*•])\s*/, '').trim()
      if (clean) {
        results.push({ title: clean, notes: '' })
      }
    } else if (e && typeof e === 'object') {
      let title = String(e.title || e.topic || e.name || e.content || '').replace(/^(\d+[\.\)\-]|[-*•])\s*/, '').trim()
      let notes = String(e.notes || e.description || e.text || '').trim()

      if (!title && notes) {
        const firstLine = notes.split('\n')[0].replace(/^(\d+[\.\)\-]|[-*•])\s*/, '').trim()
        if (firstLine.length > 70) {
          title = firstLine.slice(0, 67).trim() + '...'
        } else {
          title = firstLine
        }
      }

      if (title || notes) {
        results.push({
          title: title || 'Explore Topic',
          notes: notes || '',
          time_estimate_value: e.time_estimate_value ? Number(e.time_estimate_value) : undefined,
          time_estimate_unit: e.time_estimate_unit ? String(e.time_estimate_unit).trim() : 'hours'
        })
      }
    }
  }

  return results
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
      description: 'Propose creating a new Epic/project in the user\'s Life Stack, optionally with Explore research topics and Next execution actions. This creates a pending diff card for user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The concise, clear title of the epic/goal (e.g. "Masters Degree in Ireland")' },
          sector_id: { type: 'string', description: 'The exact ID or exact name of the sector this epic belongs to' },
          time_budget: {
            type: 'object',
            description: 'Optional planning horizon time budget (e.g. 1 month, 2 quarters, 1 year)',
            properties: {
              value: { type: 'number', description: 'Budget amount (e.g. 1, 3, 6)' },
              unit: { type: 'string', enum: ['months', 'quarters', 'years'], description: 'Budget unit' }
            }
          },
          explore_topics: {
            type: 'array',
            description: 'List of research/exploration topics, open questions, hypotheses, or things to investigate before concrete actions are known.',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Topic title (e.g. "Research Stamp 1G post-study visa rules")' },
                notes: { type: 'string', description: 'Findings, notes, references, or key questions to answer' },
                time_estimate_value: { type: 'number', description: 'Estimated research time number' },
                time_estimate_unit: { type: 'string', enum: ['hours', 'days'], description: 'Unit (hours or days)' }
              },
              required: ['title']
            }
          },
          next_items: {
            type: 'array',
            description: 'List of concrete, directly executable next action steps (not vague research).',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Action title (e.g. "Download transcript from portal")' },
                time_estimate_value: { type: 'number', description: 'Estimated effort number' },
                time_estimate_unit: { type: 'string', enum: ['mins', 'hours', 'days'], description: 'Effort unit' },
                status: { type: 'string', enum: ['next', 'today'], description: 'Initial status ("today" for top priority actions, "next" for backlog)' }
              },
              required: ['title']
            }
          },
          notes: { type: 'string', description: 'Optional high-level background context or summary for the Epic.' },
          status: { type: 'string', enum: ['active', 'paused', 'blocked', 'done', 'queued', 'parked'], description: 'Initial status (default: active or queued)' }
        },
        required: ['title', 'sector_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'explore_create',
      description: 'Propose adding a new Explore Research topic/card to an existing Epic. Use this whenever the user wants to research, investigate, explore questions, compare options, or capture unstructured findings.',
      parameters: {
        type: 'object',
        properties: {
          epic_id: { type: 'string', description: 'The exact ID of the parent Epic' },
          title: { type: 'string', description: 'Topic title (e.g. "Compare Dublin vs Cork accommodation costs")' },
          notes: { type: 'string', description: 'Detailed research findings, URLs, hypotheses, or open questions' },
          time_estimate_value: { type: 'number', description: 'Estimated research hours' },
          time_estimate_unit: { type: 'string', enum: ['hours', 'days'], description: 'Unit (hours or days)' }
        },
        required: ['epic_id', 'title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'next_items_create',
      description: 'Propose adding concrete Next Action steps (execution tasks) to an existing Epic, optionally linked under an Explore research topic.',
      parameters: {
        type: 'object',
        properties: {
          epic_id: { type: 'string', description: 'The exact ID of the parent Epic' },
          parent_explore_id: { type: 'string', description: 'Optional ID of the Explore topic card if these actions derived from that research' },
          items: {
            type: 'array',
            description: 'List of concrete next action steps',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string', description: 'Concrete action verb phrase (e.g. "Email admissions office for fee waiver")' },
                time_estimate_value: { type: 'number', description: 'Estimated effort number' },
                time_estimate_unit: { type: 'string', enum: ['mins', 'hours', 'days'], description: 'Effort unit' },
                status: { type: 'string', enum: ['next', 'today'], description: 'Status ("today" for immediate focus, "next" for backlog)' }
              },
              required: ['title']
            }
          }
        },
        required: ['epic_id', 'items']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'action_steps_create',
      description: 'Propose adding action steps to an existing item (backward compatible alias).',
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
      description: 'Propose updating an existing Epic\'s status, progress, notes, or time budget. This creates a pending diff card for user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          id: { type: 'string', description: 'The exact ID of the item/epic to update' },
          status: { type: 'string', enum: ['active', 'paused', 'blocked', 'done', 'queued', 'parked'], description: 'New status' },
          progress: { type: 'number', description: 'Progress percentage (0 to 100)' },
          notes: { type: 'string', description: 'Updated notes text' },
          time_budget: {
            type: 'object',
            properties: {
              value: { type: 'number' },
              unit: { type: 'string', enum: ['months', 'quarters', 'years'] }
            }
          }
        },
        required: ['id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'memory_search',
      description: 'Search the user\'s Life Stack epics, explore research topics, next actions, notes, and vector memory for relevant context or answers.',
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
  const focusLimit = settingsDb.get<number>('active_epic_cap') ?? settingsDb.get<number>('focus_limit') ?? 5

  const sectorCounts: Record<string, number> = {}
  sectors.forEach(s => { sectorCounts[s.id] = 0 })
  items.forEach(i => {
    if (sectorCounts[i.sector_id] !== undefined) {
      sectorCounts[i.sector_id]++
    }
  })

  const sectorSummary = sectors.map(s => `- Sector "${s.name}" (ID: ${s.id}, Icon: ${s.icon || '📁'}, Epics: ${sectorCounts[s.id] || 0})`).join('\n')
  const topActiveItems = items.filter(i => i.status === 'active').slice(0, 8).map(i => {
    const s = sectors.find(sec => sec.id === i.sector_id)
    return `  #${i.priority_rank} [${s ? s.name : 'Unknown'}] ${i.title} (${i.progress}%, status: ${i.status}) [ID: ${i.id}]`
  }).join('\n')

  return `You are LifeStack Assistant, an intelligent, active-voice productivity co-pilot embedded in LifeStack.
You help the user organize and advance their life goals across the 4-Tier LifeStack Framework:

═══════════════════════════════════════════════════════════════════════════════
THE 4-TIER LIFESTACK WORKFLOW:
═══════════════════════════════════════════════════════════════════════════════
1. SECTORS: Broad life domains (Career, Health, Learning, Side Projects, Relationships, Home & Admin).
2. ACTIVE EPICS: Major in-flight goals/initiatives (Max ${focusLimit} concurrently active) with planning horizons.
3. EXPLORE TOPICS 🔬 (Research & Discovery):
   - Unstructured findings, research notes, questions, hypotheses, URLs, comparisons, or open inquiries.
   - Example: "Research Stamp 1G post-study visa options", "Compare Dublin vs Cork tech market", "Evaluate LLM embedding latency".
   - Use Explore when things need investigation before concrete actions can be known.
4. NEXT ACTIONS ⚡ (Crisp Execution Steps) & TODAY FOCUS 🎯:
   - Concrete, non-vague executable steps (verb + noun).
   - Example: "Download visa checklist PDF", "Email professor regarding syllabus", "Schedule 30m mock interview".
   - Up to 3 high-priority actions can be pulled into the daily Today focus (status: "today").

═══════════════════════════════════════════════════════════════════════════════
CURRENT STACK STATE:
═══════════════════════════════════════════════════════════════════════════════
Active Epic Cap: ${focusLimit}
Available Sectors:
${sectorSummary}

Top Active Epics:
${topActiveItems || '  (No active epics)'}

═══════════════════════════════════════════════════════════════════════════════
BEHAVIOR & TOOL GUIDELINES:
═══════════════════════════════════════════════════════════════════════════════
1. CREATING A NEW GOAL / EPIC:
   - Call \`items_create\`.
   - Provide a descriptive 'title' (e.g. "MS in Ireland Application & Study") and appropriate 'sector_id'.
   - Set an appropriate 'time_budget' (e.g. \`{ value: 1, unit: "years" }\` or \`{ value: 6, unit: "months" }\`).
   - ALWAYS include 1 to 3 \`explore_topics\` for unknown research, comparisons, or questions (e.g. \`[{"title": "Research Stamp 1G post-study work visa requirements", "notes": "Check criteria, duration, and eligible tech roles"}, {"title": "Compare Trinity College vs UCD MSc in Computer Science", "notes": "Fees, course modules, and admission deadlines"}]\`).
   - ALWAYS include 1 to 3 \`next_items\` for immediate execution steps (e.g. \`[{"title": "Download transcript from university portal", "time_estimate_value": 1, "time_estimate_unit": "hours", "status": "today"}, {"title": "Draft statement of purpose outline", "time_estimate_value": 2, "time_estimate_unit": "hours", "status": "next"}]\`).
   - NEVER create empty Epics without Explore research or Next actions attached!
2. ADDING RESEARCH / EXPLORATION TOPICS:
   - Call \`explore_create\` with \`epic_id\`, \`title\` (concise research question/topic), and \`notes\` (findings, questions, references).
   - Use this whenever the user shares findings, asks to research something, or wants to explore options.
3. ADDING CONCRETE NEXT ACTIONS:
   - Call \`next_items_create\` with \`epic_id\` and list of \`items\` with concise action titles and estimated effort.
4. UPDATING EPICS OR CHECKING STATE:
   - Call \`items_update\` to change status, progress, notes, or time budget.
   - Call \`memory_search\` to inspect tasks, explore notes, and context before answering.
5. All item creations create pending action diff cards that require user confirmation.
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
        status: finalArgs.status || 'queued',
        time_budget: finalArgs.time_budget ? JSON.stringify(finalArgs.time_budget) : undefined
      })

      // 1. Create Explore topics if proposed
      const exploreToCreate = normalizeExploreTopics(finalArgs.explore_topics)
      for (const exp of exploreToCreate) {
        exploreItemsDb.createExploreItem({
          epic_id: newItem.id,
          title: exp.title,
          notes: exp.notes,
          time_estimate_value: exp.time_estimate_value,
          time_estimate_unit: exp.time_estimate_unit
        })
      }

      // 2. Create Next actions if proposed
      if (Array.isArray(finalArgs.next_items) && finalArgs.next_items.length > 0) {
        for (const n of finalArgs.next_items) {
          const itemTitle = typeof n === 'string' ? n : (n.title || n.content || '')
          if (itemTitle && itemTitle.trim()) {
            nextItemsDb.createNextItem({
              epic_id: newItem.id,
              title: itemTitle.trim(),
              time_estimate_value: n.time_estimate_value ? Number(n.time_estimate_value) : undefined,
              time_estimate_unit: n.time_estimate_unit || 'hours',
              status: n.status === 'today' ? 'today' : 'next'
            })
          }
        }
      }

      // 3. Fallback: create legacy action_steps / steps if passed
      const stepsToCreate = normalizeActionSteps(finalArgs.action_steps || finalArgs.steps)
      if (stepsToCreate.length > 0 && (!finalArgs.next_items || finalArgs.next_items.length === 0)) {
        for (const step of stepsToCreate) {
          nextItemsDb.createNextItem({
            epic_id: newItem.id,
            title: step.content,
            time_estimate_value: step.effort_value,
            time_estimate_unit: step.effort_unit || 'hours',
            status: 'next'
          })
        }
      }
    } else if (action.tool_name === 'explore_create' || action.tool_name === 'explore:create' || action.tool_name === 'explore_items_create') {
      if (!finalArgs.epic_id) {
        return { success: false, error: 'Missing epic_id' }
      }
      const expItems = normalizeExploreTopics(finalArgs.explore_topics || finalArgs)
      if (expItems.length === 0) {
        return { success: false, error: 'Missing explore topic content' }
      }
      for (const exp of expItems) {
        exploreItemsDb.createExploreItem({
          epic_id: finalArgs.epic_id,
          title: exp.title,
          notes: exp.notes,
          time_estimate_value: exp.time_estimate_value,
          time_estimate_unit: exp.time_estimate_unit
        })
      }
    } else if (action.tool_name === 'next_items_create' || action.tool_name === 'next_items:create') {
      if (!finalArgs.epic_id) {
        return { success: false, error: 'Missing epic_id' }
      }
      const rawItems = finalArgs.items || finalArgs.next_items || []
      const itemsList = Array.isArray(rawItems) ? rawItems : []
      if (itemsList.length === 0) {
        return { success: false, error: 'No next items provided' }
      }
      for (const item of itemsList) {
        const itemTitle = typeof item === 'string' ? item : item.title
        if (itemTitle && itemTitle.trim()) {
          nextItemsDb.createNextItem({
            epic_id: finalArgs.epic_id,
            parent_explore_id: finalArgs.parent_explore_id || null,
            title: itemTitle.trim(),
            time_estimate_value: item.time_estimate_value ? Number(item.time_estimate_value) : undefined,
            time_estimate_unit: item.time_estimate_unit || 'hours',
            status: item.status === 'today' ? 'today' : 'next'
          })
        }
      }
    } else if (action.tool_name === 'action_steps_create' || action.tool_name === 'action_steps:create') {
      if (!finalArgs.item_id) {
        return { success: false, error: 'Missing item_id' }
      }
      const stepsToCreate = normalizeActionSteps(finalArgs.steps || finalArgs.action_steps)
      for (const step of stepsToCreate) {
        nextItemsDb.createNextItem({
          epic_id: finalArgs.item_id,
          title: step.content,
          time_estimate_value: step.effort_value,
          time_estimate_unit: step.effort_unit || 'hours',
          status: 'next'
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
      if (finalArgs.time_budget !== undefined) changes.time_budget = JSON.stringify(finalArgs.time_budget)

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
