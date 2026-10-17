export type CalendarEventType = 'meeting' | 'deadline' | 'reminder' | 'milestone' | 'other'

export type CalendarEventStatus = 'scheduled' | 'completed' | 'cancelled'

export type CalendarEventParticipant = {
  memberId: string
  response?: 'pending' | 'accepted' | 'declined'
}

export type CalendarEventRecurrence = {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval?: number
  endsAt?: string
}

export type CalendarEvent = {
  id: string
  title: string
  description?: string
  start: string
  end: string
  allDay: boolean
  projectId: string | null
  type: CalendarEventType
  status: CalendarEventStatus
  participants: CalendarEventParticipant[]
  recurrence?: CalendarEventRecurrence
  /** Present for reminder events returned by the reminders API. */
  priority?: 'low' | 'medium' | 'high' | 'highest'
  /** Meeting fields persisted by the meetings API. */
  location?: string
  meetingUrl?: string
  organizerId?: string
}

export type CalendarCapabilities = {
  canCreateEvent: boolean
  canUpdateEvent: boolean
  canDeleteEvent: boolean
  canManageParticipants: boolean
}

export type CalendarMutationResult =
  | { ok: true }
  | { ok: false; message?: string }

export type CalendarDisplayCopy = {
  serviceUnavailable: string
  eventsUnavailable: string
  actionUnavailable: string
  loading: string
}
