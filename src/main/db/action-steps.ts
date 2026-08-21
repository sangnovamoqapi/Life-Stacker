import * as nextItemsDb from './next-items'
import type { ActionStep, NextItem } from '../../preload/types'

function mapNextItemToActionStep(n: NextItem): ActionStep {
  return {
    ...n,
    item_id: n.epic_id,
    content: n.title,
    is_done: n.status === 'done',
    effort_value: n.time_estimate_value,
    effort_unit: n.time_estimate_unit,
    actual_effort_value: n.actual_effort_value,
    actual_effort_unit: n.actual_effort_unit
  }
}

export function listStepsForItem(itemId: string): ActionStep[] {
  const nextList = nextItemsDb.listNextItems({ epic_id: itemId })
  return nextList.map(mapNextItemToActionStep)
}

export function listAllSteps(): ActionStep[] {
  const nextList = nextItemsDb.listNextItems()
  return nextList.map(mapNextItemToActionStep)
}

export function createStep(
  itemId: string, 
  content: string, 
  options?: { effort_value?: number; effort_unit?: string }
): ActionStep {
  const created = nextItemsDb.createNextItem({
    epic_id: itemId,
    title: content,
    time_estimate_value: options?.effort_value,
    time_estimate_unit: options?.effort_unit
  })
  return mapNextItemToActionStep(created)
}

export function updateStep(
  id: string,
  changes: Partial<{
    content: string
    is_done: boolean
    sort_order: number
    effort_value?: number | null
    effort_unit?: string | null
    actual_effort_value?: number | null
    actual_effort_unit?: string | null
  }>
): ActionStep {
  const updated = nextItemsDb.updateNextItem(id, {
    title: changes.content,
    status: changes.is_done !== undefined ? (changes.is_done ? 'done' : 'next') : undefined,
    sort_order: changes.sort_order,
    time_estimate_value: changes.effort_value,
    time_estimate_unit: changes.effort_unit,
    actual_effort_value: changes.actual_effort_value,
    actual_effort_unit: changes.actual_effort_unit
  })
  return mapNextItemToActionStep(updated)
}

export function toggleStep(id: string): ActionStep {
  const toggled = nextItemsDb.toggleNextItem(id)
  return mapNextItemToActionStep(toggled)
}

export function deleteStep(id: string): void {
  nextItemsDb.deleteNextItem(id)
}

export function reorderSteps(itemId: string, stepIds: string[]): void {
  nextItemsDb.reorderNextItems(itemId, stepIds)
}
