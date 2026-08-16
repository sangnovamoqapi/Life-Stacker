import type { ChecklistItem } from '../types'

export function parseChecklist(raw?: string | null): ChecklistItem[] {
  if (!raw || !raw.trim()) return []
  
  const trimmed = raw.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed)
      if (Array.isArray(parsed)) {
        return parsed.map((item, idx) => ({
          id: item.id || `item-${idx}-${Date.now()}`,
          text: String(item.text || ''),
          completed: Boolean(item.completed),
          effortValue: item.effortValue ? Number(item.effortValue) : undefined,
          effortUnit: item.effortUnit || 'hours',
          actualEffortValue: item.actualEffortValue ? Number(item.actualEffortValue) : undefined,
          actualEffortUnit: item.actualEffortUnit || 'hours'
        }))
      }
    } catch {
      // Fall through to plain text parsing
    }
  }

  // Plain string or multi-line string fallback
  const lines = trimmed.split('\n').filter(l => l.trim().length > 0)
  return lines.map((line, idx) => {
    let text = line.trim()
    let completed = false
    if (text.startsWith('- [x] ') || text.startsWith('- [X] ')) {
      completed = true
      text = text.substring(6)
    } else if (text.startsWith('- [ ] ')) {
      completed = false
      text = text.substring(6)
    } else if (text.startsWith('→ ')) {
      text = text.substring(2)
    } else if (text.startsWith('- ') || text.startsWith('* ')) {
      text = text.substring(2)
    }
    return {
      id: `legacy-${idx}`,
      text,
      completed
    }
  })
}

export function formatChecklist(items: ChecklistItem[]): string {
  if (!items || items.length === 0) return ''
  return JSON.stringify(items)
}

export function formatEffortBadge(value?: number, unit?: string): string {
  if (!value) return ''
  const u = unit === 'mins' ? 'min' : unit === 'days' ? 'd' : 'hr'
  return `${value} ${u}${value > 1 && unit !== 'days' ? 's' : ''}`
}
