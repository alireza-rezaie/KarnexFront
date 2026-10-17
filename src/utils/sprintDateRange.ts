import { parseIsoDate, toCanonicalIsoDate } from '@/utils/jalaliDate'

export const fixedSprintDurations = [1, 2, 3, 4] as const
export type FixedSprintDuration = typeof fixedSprintDurations[number]
export type SprintDurationMode = FixedSprintDuration | 'custom'

const dayMs = 86_400_000

const toUtcDate = (value: string | null | undefined) => {
  const canonical = toCanonicalIsoDate(value)
  const date = parseIsoDate(canonical)
  return date && canonical ? { canonical, date: new Date(Date.UTC(date.year, date.month - 1, date.day)) } : undefined
}

export const addIsoDays = (value: string, days: number) => {
  const parsed = toUtcDate(value)
  if (!parsed) return undefined
  parsed.date.setUTCDate(parsed.date.getUTCDate() + days)
  return parsed.date.toISOString().slice(0, 10)
}

export const inclusiveSprintDays = (startDate: string | null | undefined, endDate: string | null | undefined) => {
  const start = toUtcDate(startDate)
  const end = toUtcDate(endDate)
  return start && end ? Math.round((end.date.getTime() - start.date.getTime()) / dayMs) + 1 : undefined
}

export const autoSprintEndDate = (startDate: string, durationWeeks: FixedSprintDuration) => addIsoDays(startDate, durationWeeks * 7 - 1)

export const getSprintDurationMode = (startDate: string | null | undefined, endDate: string | null | undefined): SprintDurationMode => {
  const days = inclusiveSprintDays(startDate, endDate)
  const duration = fixedSprintDurations.find((weeks) => days === weeks * 7)
  return duration ?? 'custom'
}

export const sprintDurationValue = (mode: SprintDurationMode, startDate: string, endDate: string) => mode === 'custom'
  ? inclusiveSprintDays(startDate, endDate) ?? 1
  : mode
