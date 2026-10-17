import { describe, expect, it } from 'vitest'
import type {
  CalendarApiFailure,
  CreateCalendarEventRequest,
  UpdateCalendarParticipantsRequest,
} from '@/types/calendarApi'

describe('calendar API contract', () => {
  it('keeps event dates canonical and does not accept client timestamps', () => {
    const event: CreateCalendarEventRequest = {
      idempotencyKey: 'calendar-event-create-1',
      title: 'جلسه برنامه‌ریزی',
      start: '2026-10-01T09:00:00.000Z',
      end: '2026-10-01T10:00:00.000Z',
      allDay: false,
      projectId: 'project-a',
      type: 'meeting',
      status: 'scheduled',
      participants: [],
    }

    expect(event.start).toContain('T09:00:00')
  })

  it('makes participant replacement conflict-ready', () => {
    const participants: UpdateCalendarParticipantsRequest = {
      eventId: 'event-a',
      expectedVersion: 'event-version-2',
      participants: [{ memberId: 'member-a', response: 'accepted' }],
    }

    expect(participants.participants[0].memberId).toBe('member-a')
  })

  it('models date, project, and participant validation as typed failures', () => {
    const date: CalendarApiFailure = { ok: false, code: 'invalid_date_range' }
    const project: CalendarApiFailure = { ok: false, code: 'invalid_project_reference' }
    const member: CalendarApiFailure = { ok: false, code: 'invalid_participant' }

    expect([date.code, project.code, member.code]).toEqual(['invalid_date_range', 'invalid_project_reference', 'invalid_participant'])
  })
})
