import { Notification, BrowserWindow } from 'electron'
import { listSectors } from './db/sectors'
import { listItems } from './db/items'
import { get, set } from './db/settings'

let interval: NodeJS.Timeout | null = null

export function startScheduler(mainWindow: BrowserWindow): void {
  if (interval) return

  interval = setInterval(() => {
    const now = new Date()
    const currentHours = String(now.getHours()).padStart(2, '0')
    const currentMinutes = String(now.getMinutes()).padStart(2, '0')
    const currentTime = `${currentHours}:${currentMinutes}`
    const currentDayOfWeek = now.getDay()
    const todayStr = now.toISOString().split('T')[0]

    const sectors = listSectors()
    const lastNotifiedMap = get<Record<string, string>>('notification_last_sent') || {}
    let mapUpdated = false

    for (const sector of sectors) {
      if (sector.notif_enabled !== 1) continue
      if (sector.notif_time !== currentTime) continue

      let shouldNotify = false

      if (sector.notif_cadence === 'daily') {
        if (lastNotifiedMap[sector.id] !== todayStr) {
          shouldNotify = true
        }
      } else if (sector.notif_cadence === 'every_n_days') {
        const lastNotifiedStr = lastNotifiedMap[sector.id]
        if (!lastNotifiedStr) {
          shouldNotify = true
        } else {
          const lastDate = new Date(lastNotifiedStr)
          const diffTime = Math.abs(now.getTime() - lastDate.getTime())
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
          if (diffDays >= (sector.notif_interval_days || 1)) {
            shouldNotify = true
          }
        }
      } else if (sector.notif_cadence === 'weekdays') {
        try {
          const daysArray = JSON.parse(sector.notif_weekdays || '[]')
          if (Array.isArray(daysArray) && daysArray.includes(currentDayOfWeek)) {
            if (lastNotifiedMap[sector.id] !== todayStr) {
              shouldNotify = true
            }
          }
        } catch (e) {
          // invalid JSON
        }
      }

      if (shouldNotify) {
        // Fetch active/paused items for body
        const items = listItems({ sector_id: sector.id }).filter(i => i.status === 'active' || i.status === 'paused')
        const bodyLines = items.slice(0, 3).map(i => `- ${i.title}`)
        const body = bodyLines.length > 0 ? bodyLines.join('\n') : 'Time to check in on this sector!'

        const notification = new Notification({
          title: sector.name,
          body
        })

        notification.on('click', () => {
          if (mainWindow) {
            mainWindow.show()
            mainWindow.focus()
            mainWindow.webContents.send('navigate-to-sector', sector.id)
          }
        })

        notification.show()

        lastNotifiedMap[sector.id] = todayStr
        mapUpdated = true
      }
    }

    if (mapUpdated) {
      set('notification_last_sent', lastNotifiedMap)
    }

    // Weekly stack review notification
    const stackReviewEnabled = get<boolean>('stack_review_enabled')
    if (stackReviewEnabled !== false) {
      const reviewDay = get<number>('stack_review_day') ?? 0  // Sunday
      const reviewTime = get<string>('stack_review_time') ?? '18:00'
      
      if (currentDayOfWeek === reviewDay && currentTime === reviewTime) {
        const lastReview = get<string>('stack_review_last_sent')
        if (lastReview !== todayStr) {
          // Find the single item with oldest updated_at, status active or paused only
          const allItems = listItems()
          const reviewCandidates = allItems.filter(i => i.status === 'active' || i.status === 'paused')
          
          if (reviewCandidates.length > 0) {
            reviewCandidates.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
            const stalest = reviewCandidates[0]
            const staleDays = Math.floor((now.getTime() - new Date(stalest.updated_at).getTime()) / (1000 * 60 * 60 * 24))
            
            const notification = new Notification({
              title: 'Weekly Stack Review',
              body: `Still a priority? '${stalest.title}' hasn't moved in ${staleDays} days`
            })
            
            notification.on('click', () => {
              if (mainWindow) {
                mainWindow.show()
                mainWindow.focus()
                mainWindow.webContents.send('navigate-to-item', stalest.id)
              }
            })
            
            notification.show()
          }
          
          set('stack_review_last_sent', todayStr)
        }
      }
    }
  }, 60000)
}

export function stopScheduler(): void {
  if (interval) {
    clearInterval(interval)
    interval = null
  }
}
