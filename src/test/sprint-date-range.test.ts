import { describe, expect, it } from 'vitest'
import { autoSprintEndDate, getSprintDurationMode, inclusiveSprintDays, sprintDurationValue } from '@/utils/sprintDateRange'

describe('sprint date range', () => {
  it('calculates inclusive fixed-length sprint end dates from the ISO start date', () => {
    expect(autoSprintEndDate('2026-03-21', 1)).toBe('2026-03-27')
    expect(autoSprintEndDate('2026-03-21', 2)).toBe('2026-04-03')
    expect(autoSprintEndDate('2026-03-21', 4)).toBe('2026-04-17')
  })

  it('restores fixed duration modes and keeps arbitrary ranges custom', () => {
    expect(getSprintDurationMode('2026-03-21', '2026-04-03')).toBe(2)
    expect(getSprintDurationMode('2026-03-21', '2026-04-01')).toBe('custom')
    expect(inclusiveSprintDays('2026-03-21', '2026-04-01')).toBe(12)
    expect(sprintDurationValue('custom', '2026-03-21', '2026-04-01')).toBe(12)
  })
})
