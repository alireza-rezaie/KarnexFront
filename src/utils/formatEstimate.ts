import { formatNumber } from '@/lib/persian-numbers'

const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE
const SECONDS_PER_WORKDAY = 8 * SECONDS_PER_HOUR

export function formatEstimatedSeconds(seconds?: number) {
  if (!seconds || seconds <= 0) return '—'

  if (seconds < SECONDS_PER_HOUR) {
    return `${formatNumber(Math.max(1, Math.round(seconds / SECONDS_PER_MINUTE)))} دقیقه`
  }

  if (seconds < SECONDS_PER_WORKDAY) {
    return `${formatNumber(Math.round(seconds / SECONDS_PER_HOUR))} ساعت`
  }

  return `${formatNumber(Math.round(seconds / SECONDS_PER_WORKDAY))} روز`
}
