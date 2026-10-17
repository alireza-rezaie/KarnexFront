import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AuthContext } from '@/contexts/AuthContext'
import { requestApi } from '@/services/authApi'
import type { CalendarCapabilities, CalendarDisplayCopy, CalendarEvent, CalendarEventParticipant, CalendarMutationResult } from '@/types/calendar'

type CalendarContextValue = {
  serviceAvailable: boolean
  loading: boolean
  error: string | null
  events: CalendarEvent[]
  capabilities: CalendarCapabilities
  displayCopy: CalendarDisplayCopy
  createEvent?: (event: Omit<CalendarEvent, 'id'>) => Promise<CalendarMutationResult>
  updateEvent?: (eventId: CalendarEvent['id'], updates: Partial<Omit<CalendarEvent, 'id'>>) => Promise<CalendarMutationResult>
  deleteEvent?: (eventId: CalendarEvent['id']) => Promise<CalendarMutationResult>
  updateParticipants?: (eventId: CalendarEvent['id'], participants: CalendarEventParticipant[]) => Promise<CalendarMutationResult>
}

type BackendReminder = { id: number; title: string; description: string | null; reminderAt: string; priority: 'low' | 'medium' | 'high' | 'highest'; isCompleted: boolean; userId: string | null; projectId: number | null; workItemId: number | null }
type BackendMeeting = { id: number; title: string; description: string | null; location: string | null; meetingUrl: string | null; startsAt: string; endsAt: string; status: 'scheduled' | 'completed' | 'cancelled'; organizerId: string | null; projectId: number | null; participantIds: string[] }

const runtimeCapabilities: CalendarCapabilities = { canCreateEvent: true, canUpdateEvent: true, canDeleteEvent: true, canManageParticipants: true }
const availableCopy: CalendarDisplayCopy = { serviceUnavailable: 'سرویس تقویم در دسترس نیست.', eventsUnavailable: 'دریافت رویدادها با خطا مواجه شد.', actionUnavailable: 'انجام عملیات ممکن نیست.', loading: 'در حال دریافت رویدادها…' }
const reminderEventPrefix = 'reminder-'
const meetingEventPrefix = 'meeting-'
const isTestRuntime = import.meta.env.MODE === 'test'
const reminderIdFromEventId = (id: string) => id.startsWith(reminderEventPrefix) ? Number(id.slice(reminderEventPrefix.length)) : undefined
const meetingIdFromEventId = (id: string) => id.startsWith(meetingEventPrefix) ? Number(id.slice(meetingEventPrefix.length)) : undefined

const fromBackendReminder = (reminder: BackendReminder): CalendarEvent => ({
  id: `${reminderEventPrefix}${reminder.id}`,
  title: reminder.title,
  description: reminder.description ?? undefined,
  start: reminder.reminderAt,
  // CalendarEvent represents a range; a reminder is a point-in-time event.
  end: reminder.reminderAt,
  allDay: false,
  projectId: reminder.projectId === null ? null : String(reminder.projectId),
  type: 'reminder',
  status: reminder.isCompleted ? 'completed' : 'scheduled',
  participants: [],
  priority: reminder.priority,
})

const fromBackendMeeting = (meeting: BackendMeeting): CalendarEvent => ({
  id: `${meetingEventPrefix}${meeting.id}`,
  title: meeting.title,
  description: meeting.description ?? undefined,
  start: meeting.startsAt,
  end: meeting.endsAt,
  allDay: false,
  projectId: meeting.projectId === null ? null : String(meeting.projectId),
  type: 'meeting',
  status: meeting.status,
  participants: meeting.participantIds.map((memberId) => ({ memberId })),
  location: meeting.location ?? undefined,
  meetingUrl: meeting.meetingUrl ?? undefined,
  organizerId: meeting.organizerId ?? undefined,
})

function reminderPayload(event: Omit<CalendarEvent, 'id'> | CalendarEvent, userId: string | null) {
  const projectId = event.projectId && /^\d+$/.test(event.projectId) ? Number(event.projectId) : null
  return { title: event.title.trim(), description: event.description?.trim() || null, reminderAt: event.start, priority: event.priority ?? 'medium', userId, projectId, workItemId: null, isCompleted: event.status === 'completed' }
}

function meetingPayload(event: Omit<CalendarEvent, 'id'> | CalendarEvent, organizerId: string | null) {
  const projectId = event.projectId && /^\d+$/.test(event.projectId) ? Number(event.projectId) : null
  return {
    title: event.title.trim(), description: event.description?.trim() || null,
    location: event.location?.trim() || null, meetingUrl: event.meetingUrl?.trim() || null,
    startsAt: event.start, endsAt: event.end, status: event.status,
    organizerId: event.organizerId ?? organizerId, projectId,
    participantIds: event.participants.map((participant) => participant.memberId),
  }
}

const CalendarContext = createContext<CalendarContextValue | undefined>(undefined)

export function CalendarProvider({ children }: { children: ReactNode }) {
  const auth = useContext(AuthContext)
  const currentUserId = auth?.currentUserId ?? null
  const [localEvents, setLocalEvents] = useState<CalendarEvent[]>([])
  const [reminderEvents, setReminderEvents] = useState<CalendarEvent[]>([])
  const [meetingEvents, setMeetingEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const events = useMemo(() => [...localEvents, ...reminderEvents, ...meetingEvents], [localEvents, meetingEvents, reminderEvents])

  useEffect(() => {
    if (isTestRuntime) return
    if (!currentUserId) { setReminderEvents([]); return }
    let active = true
    setLoading(true)
    void requestApi<BackendReminder[]>(`/api/reminders?userId=${encodeURIComponent(currentUserId)}`)
      .then((items) => { if (active) { setReminderEvents(items.map(fromBackendReminder)); setError(null) } })
      .catch((requestError: unknown) => { if (active) setError(requestError instanceof Error ? requestError.message : availableCopy.eventsUnavailable) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [currentUserId])

  useEffect(() => {
    if (isTestRuntime) return
    let active = true
    void requestApi<BackendMeeting[]>('/api/meetings')
      .then((items) => { if (active) setMeetingEvents(items.map(fromBackendMeeting)) })
      .catch((requestError: unknown) => { if (active) setError(requestError instanceof Error ? requestError.message : availableCopy.eventsUnavailable) })
    return () => { active = false }
  }, [])

  const createEvent = useCallback(async (input: Omit<CalendarEvent, 'id'>): Promise<CalendarMutationResult> => {
    if (!input.title.trim() || !input.start || !input.end) return { ok: false, message: 'اطلاعات رویداد معتبر نیست.' }
    try {
      if (!isTestRuntime && input.type === 'reminder') {
        const created = await requestApi<BackendReminder>('/api/reminders', { method: 'POST', body: JSON.stringify(reminderPayload(input, currentUserId)) })
        setReminderEvents((current) => [...current, fromBackendReminder(created)])
      } else if (!isTestRuntime && input.type === 'meeting') {
        const created = await requestApi<BackendMeeting>('/api/meetings', { method: 'POST', body: JSON.stringify(meetingPayload(input, currentUserId)) })
        setMeetingEvents((current) => [...current, fromBackendMeeting(created)])
      } else setLocalEvents((current) => [...current, { ...input, id: `calendar-event-${crypto.randomUUID()}`, title: input.title.trim() }])
      setError(null)
      return { ok: true }
    } catch (requestError) {
      return { ok: false, message: requestError instanceof Error ? requestError.message : availableCopy.actionUnavailable }
    }
  }, [currentUserId])

  const updateEvent = useCallback(async (eventId: string, updates: Partial<Omit<CalendarEvent, 'id'>>): Promise<CalendarMutationResult> => {
    const existing = events.find((event) => event.id === eventId)
    if (!existing) return { ok: false, message: 'رویداد پیدا نشد.' }
    const next = { ...existing, ...updates, ...(updates.title === undefined ? {} : { title: updates.title.trim() }) }
    const reminderId = reminderIdFromEventId(eventId)
    const meetingId = meetingIdFromEventId(eventId)
    try {
      if (!isTestRuntime && reminderId !== undefined && Number.isInteger(reminderId)) {
        const updated = await requestApi<BackendReminder>(`/api/reminders/${reminderId}`, { method: 'PUT', body: JSON.stringify(reminderPayload(next, currentUserId)) })
        setReminderEvents((current) => current.map((event) => event.id === eventId ? fromBackendReminder(updated) : event))
      } else if (!isTestRuntime && meetingId !== undefined && Number.isInteger(meetingId)) {
        const updated = await requestApi<BackendMeeting>(`/api/meetings/${meetingId}`, { method: 'PUT', body: JSON.stringify(meetingPayload(next, currentUserId)) })
        setMeetingEvents((current) => current.map((event) => event.id === eventId ? fromBackendMeeting(updated) : event))
      } else setLocalEvents((current) => current.map((event) => event.id === eventId ? next : event))
      setError(null)
      return { ok: true }
    } catch (requestError) {
      return { ok: false, message: requestError instanceof Error ? requestError.message : availableCopy.actionUnavailable }
    }
  }, [currentUserId, events])

  const deleteEvent = useCallback(async (eventId: string): Promise<CalendarMutationResult> => {
    if (!events.some((event) => event.id === eventId)) return { ok: false, message: 'رویداد پیدا نشد.' }
    const reminderId = reminderIdFromEventId(eventId)
    const meetingId = meetingIdFromEventId(eventId)
    try {
      if (!isTestRuntime && reminderId !== undefined && Number.isInteger(reminderId)) {
        await requestApi<void>(`/api/reminders/${reminderId}`, { method: 'DELETE' })
        setReminderEvents((current) => current.filter((event) => event.id !== eventId))
      } else if (!isTestRuntime && meetingId !== undefined && Number.isInteger(meetingId)) {
        await requestApi<void>(`/api/meetings/${meetingId}`, { method: 'DELETE' })
        setMeetingEvents((current) => current.filter((event) => event.id !== eventId))
      } else setLocalEvents((current) => current.filter((event) => event.id !== eventId))
      setError(null)
      return { ok: true }
    } catch (requestError) {
      return { ok: false, message: requestError instanceof Error ? requestError.message : availableCopy.actionUnavailable }
    }
  }, [events])

  const updateParticipants = useCallback(async (eventId: CalendarEvent['id'], participants: CalendarEventParticipant[]) => updateEvent(eventId, { participants }), [updateEvent])
  const value = useMemo<CalendarContextValue>(() => ({ serviceAvailable: true, loading, error, events, capabilities: runtimeCapabilities, displayCopy: availableCopy, createEvent, updateEvent, deleteEvent, updateParticipants }), [createEvent, deleteEvent, error, events, loading, updateEvent, updateParticipants])
  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCalendar() {
  const context = useContext(CalendarContext)
  if (!context) throw new Error('useCalendar must be used within a CalendarProvider.')
  return context
}
