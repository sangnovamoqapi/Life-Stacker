const OLLAMA_BASE_URL = 'http://127.0.0.1:11434'
const DEFAULT_EMBED_MODEL = 'nomic-embed-text'

let lastError: string | null = null

export function getLastError(): string | null {
  return lastError
}

export function setLastError(err: string | null): void {
  lastError = err
}

export async function checkStatus(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 2000)
    
    // Check if Ollama is running
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      signal: controller.signal,
      cache: 'no-store'
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      lastError = `Ollama server returned HTTP ${res.status}`
      return false
    }

    const data = await res.json() as { models?: { name: string }[] }
    const models = Array.isArray(data.models) ? data.models.map(m => m.name.toLowerCase()) : []
    const hasEmbedModel = models.some(m => m.includes('nomic-embed-text'))

    if (!hasEmbedModel) {
      lastError = `Ollama connected, but '${DEFAULT_EMBED_MODEL}' is missing. Run 'ollama pull nomic-embed-text'.`
      // Server is reachable, but embed model missing
      return false
    }

    // Fully ready
    lastError = null
    return true
  } catch (err: any) {
    if (err.name === 'AbortError') {
      lastError = 'Ollama connection timed out'
    } else {
      lastError = 'Ollama offline (cannot connect to http://127.0.0.1:11434)'
    }
    return false
  }
}

export async function listModels(): Promise<string[]> {
  try {
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json() as { models?: { name: string }[] }
    return Array.isArray(data.models) ? data.models.map(m => m.name) : []
  } catch {
    return []
  }
}

export async function getBestChatModel(preferredModel?: string): Promise<string> {
  const models = await listModels()
  if (preferredModel && models.some(m => m.toLowerCase() === preferredModel.toLowerCase())) {
    return preferredModel
  }
  const chatCandidates = models.filter(m => !m.toLowerCase().includes('embed'))
  if (preferredModel && chatCandidates.some(m => m.toLowerCase().includes(preferredModel.toLowerCase().split(':')[0]))) {
    return chatCandidates.find(m => m.toLowerCase().includes(preferredModel.toLowerCase().split(':')[0]))!
  }
  if (chatCandidates.length > 0) {
    const topPick = chatCandidates.find(m => m.includes('llama3.2') || m.includes('qwen2.5') || m.includes('qwen3')) || chatCandidates[0]
    return topPick
  }
  return preferredModel || 'llama3.2:3b'
}

export type EmbeddingType = 'query' | 'document'

export async function embed(
  text: string, 
  type: EmbeddingType = 'document', 
  model: string = DEFAULT_EMBED_MODEL
): Promise<number[] | null> {
  if (!text || text.trim().length === 0) return null

  const trimmed = text.trim()
  const prefix = type === 'query' ? 'search_query: ' : 'search_document: '
  const formattedText = trimmed.startsWith(prefix) ? trimmed : `${prefix}${trimmed}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    // Try standard /api/embeddings endpoint
    const res = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: formattedText
      }),
      signal: controller.signal,
      cache: 'no-store'
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json() as { embedding?: number[] }
      if (Array.isArray(data.embedding) && data.embedding.length > 0) {
        lastError = null
        return data.embedding
      }
    }

    // Try fallback to /api/embed endpoint
    const fallbackRes = await fetch(`${OLLAMA_BASE_URL}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        input: formattedText
      }),
      cache: 'no-store'
    })

    if (fallbackRes.ok) {
      const fallbackData = await fallbackRes.json() as { embeddings?: number[][] }
      if (Array.isArray(fallbackData.embeddings) && Array.isArray(fallbackData.embeddings[0])) {
        lastError = null
        return fallbackData.embeddings[0]
      }
    }

    // If both failed, extract error message if available
    let errorDetail = `Failed to generate embeddings using '${model}'`
    try {
      const errorJson = await res.json() as { error?: string }
      if (errorJson.error) errorDetail = errorJson.error
    } catch {}

    lastError = errorDetail
    console.error(`[AI Embed Error] ${errorDetail}`)
    return null
  } catch (err: any) {
    const msg = err?.name === 'AbortError' ? 'Embedding generation timed out' : `Embedding failed: ${err?.message || err}`
    lastError = msg
    console.error(`[AI Embed Exception] ${msg}`)
    return null
  }
}

export async function generateDraftNextItems(
  exploreTitle: string,
  exploreNotes: string
): Promise<{ title: string; time_estimate_value?: number; time_estimate_unit?: string }[]> {
  const isOnline = await checkStatus()
  const fallbackRows: { title: string; time_estimate_value?: number; time_estimate_unit?: string }[] = []

  // Heuristic parse from notes
  const lines = (exploreNotes || '').split('\n').map(l => l.trim()).filter(Boolean)
  const bulletLines = lines.filter(l => /^(\d+[\.\)\-]|[-*•])\s+/.test(l))
  if (bulletLines.length > 0) {
    bulletLines.forEach(l => {
      const clean = l.replace(/^(\d+[\.\)\-]|[-*•])\s+/, '').trim()
      if (clean.length > 2) {
        fallbackRows.push({ title: clean, time_estimate_value: 2, time_estimate_unit: 'hours' })
      }
    })
  }

  if (!isOnline) {
    if (fallbackRows.length > 0) return fallbackRows
    return [{ title: `Action for ${exploreTitle || 'Research'}`, time_estimate_value: 1, time_estimate_unit: 'hours' }]
  }

  try {
    const model = await getBestChatModel()
    const prompt = `You are a high-performance productivity assistant in LifeStack. 
Convert the following research findings into 2 to 4 concrete, actionable next steps.
Topic: "${exploreTitle}"
Findings & Notes:
"""
${exploreNotes}
"""

Return ONLY a valid JSON array of objects with keys: "title" (concise action verb phrase) and "time_estimate_value" (estimated hours as number, e.g. 2) and "time_estimate_unit" ("hours" or "mins").
Example output:
[
  {"title": "Draft proposal for application", "time_estimate_value": 3, "time_estimate_unit": "hours"},
  {"title": "Schedule consultation call", "time_estimate_value": 30, "time_estimate_unit": "mins"}
]`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000)

    const res = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        format: 'json'
      }),
      signal: controller.signal
    })
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json() as { response?: string }
      if (data.response) {
        const parsed = JSON.parse(data.response)
        const rawList = Array.isArray(parsed) ? parsed : (parsed.items || parsed.actions || parsed.steps || [])
        if (Array.isArray(rawList) && rawList.length > 0) {
          const valid = rawList.map((item: any) => ({
            title: String(item.title || item.action || item.text || '').trim(),
            time_estimate_value: typeof item.time_estimate_value === 'number' ? item.time_estimate_value : (typeof item.effort_value === 'number' ? item.effort_value : undefined),
            time_estimate_unit: typeof item.time_estimate_unit === 'string' ? item.time_estimate_unit : 'hours'
          })).filter(item => item.title.length > 0)

          if (valid.length > 0) return valid
        }
      }
    }
  } catch (err) {
    console.warn('[AI Generate Next Items] Fallback due to:', err)
  }

  if (fallbackRows.length > 0) return fallbackRows
  return [{ title: `Action for ${exploreTitle || 'Research'}`, time_estimate_value: 1, time_estimate_unit: 'hours' }]
}
