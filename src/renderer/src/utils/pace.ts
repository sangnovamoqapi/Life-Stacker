import type { TimeBudget } from '../types'

export interface EpicPaceInfo {
  budgetDays: number | null
  elapsedDays: number
  timeElapsedPercent: number | null
  totalHoursLogged: number
  weeklyBurnHours: number
  velocityStatus: 'ahead' | 'on_track' | 'behind' | 'no_budget'
  statusLabel: string
  projectedWeeksToComplete: number | null
}

export function calculateEpicPace(
  createdAt: string,
  timeBudget?: TimeBudget | string | null,
  executionProgress: number = 0,
  totalHoursLogged: number = 0,
  entriesDaysLogged: number = 0
): EpicPaceInfo {
  const elapsedDays = Math.max(1, Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)))
  const totalHours = totalHoursLogged + (entriesDaysLogged * 8)
  const weeklyBurnHours = (totalHours / elapsedDays) * 7

  let budget: TimeBudget | null = null
  if (typeof timeBudget === 'string') {
    try {
      budget = JSON.parse(timeBudget)
    } catch {}
  } else if (timeBudget && typeof timeBudget === 'object') {
    budget = timeBudget
  }

  if (!budget || !budget.value || budget.value <= 0) {
    return {
      budgetDays: null,
      elapsedDays,
      timeElapsedPercent: null,
      totalHoursLogged: totalHours,
      weeklyBurnHours,
      velocityStatus: 'no_budget',
      statusLabel: totalHours > 0 ? `${weeklyBurnHours.toFixed(1)} hrs/wk burn` : 'No budget set',
      projectedWeeksToComplete: null
    }
  }

  const multiplier = budget.unit === 'years' ? 365 : budget.unit === 'quarters' ? 90 : 30
  const budgetDays = budget.value * multiplier
  const timeElapsedPercent = Math.min(100, Math.round((elapsedDays / budgetDays) * 100))

  let velocityStatus: 'ahead' | 'on_track' | 'behind' = 'on_track'
  let statusLabel = 'On Pace'

  if (executionProgress > 0 && timeElapsedPercent > 0) {
    const paceRatio = executionProgress / timeElapsedPercent
    if (paceRatio >= 1.15) {
      velocityStatus = 'ahead'
      statusLabel = 'Ahead of Horizon'
    } else if (paceRatio <= 0.75) {
      velocityStatus = 'behind'
      statusLabel = 'Moderate Velocity'
    } else {
      velocityStatus = 'on_track'
      statusLabel = 'On Pace'
    }
  }

  // Projected weeks to completion based on progress velocity
  let projectedWeeksToComplete: number | null = null
  if (executionProgress > 0 && executionProgress < 100) {
    const daysPerPercent = elapsedDays / executionProgress
    const remainingPercent = 100 - executionProgress
    const remainingDays = remainingPercent * daysPerPercent
    projectedWeeksToComplete = Math.max(1, Math.round(remainingDays / 7))
  }

  return {
    budgetDays,
    elapsedDays,
    timeElapsedPercent,
    totalHoursLogged: totalHours,
    weeklyBurnHours,
    velocityStatus,
    statusLabel,
    projectedWeeksToComplete
  }
}
