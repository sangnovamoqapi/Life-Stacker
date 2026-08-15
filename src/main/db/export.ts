import { listSectors } from './sectors'
import { listItems } from './items'
import { getTotals } from './effort-log'

export function exportSnapshot(): string {
  const snapshot = {
    exportedAt: new Date().toISOString(),
    sectors: listSectors().map(s => ({
      id: s.id,
      name: s.name,
      color: s.color
    })),
    items: listItems().map(i => ({
      id: i.id,
      sectorId: i.sector_id,
      title: i.title,
      status: i.status,
      progress: i.progress,
      updatedAt: i.updated_at
    })),
    effortTotals: getTotals().map(t => ({
      itemId: t.item_id,
      totalHours: t.total_hours
    }))
  }
  return JSON.stringify(snapshot, null, 2)
}
