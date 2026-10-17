import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { CalendarProvider, useCalendar } from '@/contexts/CalendarContext'

function Wrapper({ children }: { children: ReactNode }) { return <CalendarProvider>{children}</CalendarProvider> }

describe('calendar session runtime', () => {
  it('creates, edits, and deletes only user-supplied events without browser storage', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem')
    const { result } = renderHook(() => useCalendar(), { wrapper: Wrapper })
    const input = { title: 'جلسهٔ برنامه‌ریزی', start: '2026-09-26T09:00', end: '2026-09-26T10:00', allDay: false, projectId: null, type: 'meeting' as const, status: 'scheduled' as const, participants: [] }
    await act(async () => { expect(await result.current.createEvent?.(input)).toEqual({ ok: true }) })
    const eventId = result.current.events[0]?.id ?? ''
    expect(eventId).toMatch(/^calendar-event-/)
    await act(async () => { expect(await result.current.updateEvent?.(eventId, { title: 'جلسهٔ ویرایش‌شده' })).toEqual({ ok: true }) })
    expect(result.current.events[0]?.title).toBe('جلسهٔ ویرایش‌شده')
    await act(async () => { expect(await result.current.deleteEvent?.(eventId)).toEqual({ ok: true }) })
    expect(result.current.events).toEqual([])
    expect(await result.current.deleteEvent?.('missing')).toEqual({ ok: false, message: 'رویداد پیدا نشد.' })
    expect(storage).not.toHaveBeenCalled()
  })
})
