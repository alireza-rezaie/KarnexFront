import { describe, expect, it } from 'vitest'
import { resolveCalendarIntent } from '@/utils/calendarIntent'

const today = { year: 1403, month: 7, day: 2 }

describe('calendar navigation intent', () => {
  it('selects the provided Jalali today date and day view', () => {
    expect(resolveCalendarIntent('?view=day&date=today', today)).toEqual({ view: 'day', date: today })
  })

  it('keeps invalid query values safe', () => {
    expect(resolveCalendarIntent('?view=invalid&date=unknown', today)).toEqual({ view: undefined, date: undefined })
  })

  it('leaves normal Calendar navigation without an intent unchanged', () => {
    expect(resolveCalendarIntent('', today)).toEqual({ view: undefined, date: undefined })
  })
})
