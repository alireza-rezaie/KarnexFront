import type { CalendarEvent, CalendarEventParticipant } from '@/types/calendar'
import type { ApiErrorCode, ApiFailure, ApiResult, ApiSuccess, ApiVersionMismatch, IdempotentCommand } from '@/types/api'

/** Canonical transport failures for Calendar event operations. */
export type CalendarApiErrorCode = ApiErrorCode<
  | 'invalid_participant'
  | 'invalid_project_reference'
  | 'invalid_date_range'
>

export type CalendarApiFailure = ApiFailure<CalendarApiErrorCode, {
  currentVersion?: string
}>

export type CalendarApiSuccess<T> = ApiSuccess<T>
export type CalendarApiResult<T> = ApiResult<T, CalendarApiErrorCode, { currentVersion?: string }>
export type CalendarEventMutationResponse<T> =
  | ApiSuccess<T>
  | ApiVersionMismatch<'currentEventVersion'>
  | ApiFailure<Exclude<CalendarApiErrorCode, 'version_mismatch'>>

/** Dates remain canonical ISO values. Jalali conversion is exclusively a frontend concern. */
export type AuthoritativeCalendarEvent = CalendarEvent & {
  createdAt: string
  updatedAt: string
  version: string
}

export type ListCalendarEventsQuery = {
  rangeStart: string
  rangeEnd: string
  projectId?: string
  participantId?: string
  cursor?: string
  limit?: number
}

export type ListCalendarEventsResponse = CalendarApiResult<{
  events: AuthoritativeCalendarEvent[]
  nextCursor?: string
}>

export type GetCalendarEventResponse = CalendarApiResult<{
  event: AuthoritativeCalendarEvent
}>

/** Creator identity and authoritative timestamps are derived server-side. */
export type CreateCalendarEventRequest = Omit<CalendarEvent, 'id'> & IdempotentCommand
export type CreateCalendarEventResponse = CalendarApiResult<{
  event: AuthoritativeCalendarEvent
}>

export type UpdateCalendarEventRequest = {
  eventId: string
  expectedVersion: string
  changes: Partial<Omit<CalendarEvent, 'id' | 'participants'>>
}

export type UpdateCalendarEventResponse = CalendarEventMutationResponse<{
  event: AuthoritativeCalendarEvent
}>

export type DeleteCalendarEventRequest = {
  eventId: string
  expectedVersion: string
}

export type DeleteCalendarEventResponse = CalendarEventMutationResponse<{
  eventId: string
}>

export type UpdateCalendarParticipantsRequest = {
  eventId: string
  expectedVersion: string
  participants: CalendarEventParticipant[]
}

export type UpdateCalendarParticipantsResponse = CalendarEventMutationResponse<{
  event: AuthoritativeCalendarEvent
}>

/**
 * The backend validates end >= start, referenced project/member IDs, and recurrence.
 * Visibility follows event policy; project events additionally require project access.
 * Create may be optimistic with rollback, while update/delete/participants need versions.
 */
export interface CalendarApiContract {
  listEvents(query: ListCalendarEventsQuery): Promise<ListCalendarEventsResponse>
  getEvent(eventId: string): Promise<GetCalendarEventResponse>
  createEvent(input: CreateCalendarEventRequest): Promise<CreateCalendarEventResponse>
  updateEvent(input: UpdateCalendarEventRequest): Promise<UpdateCalendarEventResponse>
  deleteEvent(input: DeleteCalendarEventRequest): Promise<DeleteCalendarEventResponse>
  updateParticipants(input: UpdateCalendarParticipantsRequest): Promise<UpdateCalendarParticipantsResponse>
}
