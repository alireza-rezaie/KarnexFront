import type { JalaliDate } from '@/utils/jalaliDate'

export type CalendarIntentView = 'day' | 'week' | 'month'

export function resolveCalendarIntent(search: string, today: JalaliDate | undefined) {
  const params = new URLSearchParams(search)
  const requestedView = params.get('view')
  const view: CalendarIntentView | undefined = requestedView === 'day' || requestedView === 'week' || requestedView === 'month'
    ? requestedView
    : undefined

  return {
    view,
    date: params.get('date') === 'today' ? today : undefined,
  }
}
