import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Bug, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, CircleUserRound,
  Flag, ListFilter, Plus, Search, UsersRound,
} from 'lucide-react'
import { useCalendar } from '@/contexts/CalendarContext'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { JalaliDatePicker } from '@/components/JalaliDatePicker'
import type { CalendarEvent } from '@/types/calendar'
import { toPersianDigits } from '@/lib/persian-numbers'
import { getCurrentJalaliDate, jalaliDaysInMonth, jalaliToGregorian, parseJalaliDate, type JalaliDate } from '@/utils/jalaliDate'
import { resolveCalendarIntent } from '@/utils/calendarIntent'

type View = 'day' | 'week' | 'month'
type Category = 'meeting' | 'deadline' | 'test' | 'customer'
type CalendarUiEvent = { id: string; year: number; month: number; day: number; title: string; time: string; category: Category }
type EventForm = { title: string; description: string; location: string; startDate: string; startTime: string; endDate: string; endTime: string; type: CalendarEvent['type'] }

const months = ['', 'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
const weekdays = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه']
const categoryMeta: Record<Category, { label: string; dot: string; chip: string }> = {
  meeting: { label: 'جلسات', dot: 'bg-blue-500', chip: 'border-blue-500/35 bg-blue-500/12 text-blue-300' },
  deadline: { label: 'ددلاین‌ها', dot: 'bg-red-500', chip: 'border-red-500/35 bg-red-500/12 text-red-300' },
  test: { label: 'تست', dot: 'bg-emerald-500', chip: 'border-emerald-500/35 bg-emerald-500/12 text-emerald-300' },
  customer: { label: 'مشتری', dot: 'bg-purple-500', chip: 'border-purple-500/35 bg-purple-500/12 text-purple-300' },
}

const jalaliMonthStartOffset = (year: number, month: number) => {
  const date = jalaliToGregorian(year, month, 1)
  return (new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay() + 1) % 7
}

const sameJalaliDate = (first: JalaliDate, second: JalaliDate) => first.year === second.year && first.month === second.month && first.day === second.day

const shiftJalaliDate = (date: JalaliDate, offset: number): JalaliDate => {
  let { year, month, day } = date
  let remaining = offset

  while (remaining > 0) {
    const daysInMonth = jalaliDaysInMonth(year, month)
    if (day < daysInMonth) day++
    else if (month < 12) { month++; day = 1 }
    else { year++; month = 1; day = 1 }
    remaining--
  }

  while (remaining < 0) {
    if (day > 1) day--
    else if (month > 1) { month--; day = jalaliDaysInMonth(year, month) }
    else { year--; month = 12; day = jalaliDaysInMonth(year, month) }
    remaining++
  }

  return { year, month, day }
}

const shiftJalaliMonth = (date: JalaliDate, offset: number): JalaliDate => {
  const totalMonths = date.year * 12 + date.month - 1 + offset
  const year = Math.floor(totalMonths / 12)
  const month = (totalMonths % 12) + 1
  return { year, month, day: Math.min(date.day, jalaliDaysInMonth(year, month)) }
}

const createEmptyEventForm = (): EventForm => ({ title: '', description: '', location: '', startDate: '', startTime: '', endDate: '', endTime: '', type: 'meeting' })

const createEventForm = (event: CalendarEvent | null): EventForm => {
  if (!event) return createEmptyEventForm()
  return {
    title: event.title,
    description: event.description ?? '',
    location: event.location ?? '',
    startDate: event.start.slice(0, 10),
    startTime: event.start.slice(11, 16),
    endDate: event.end.slice(0, 10),
    endTime: event.end.slice(11, 16),
    type: event.type,
  }
}

const toCalendarDateTime = (date: string, time: string) => date && time ? `${date}T${time}` : ''

const toCalendarUiEvent = (event: { id: string; title: string; start: string; type: string }): CalendarUiEvent | null => {
  let date = parseJalaliDate(event.start)
  if (!date) {
    const parsed = new Date(event.start)
    if (Number.isNaN(parsed.getTime())) return null
    const parts = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(parsed)
    const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(item => item.type === type)?.value)
    date = { year: part('year'), month: part('month'), day: part('day') }
  }
  if (!date || date.day > jalaliDaysInMonth(date.year, date.month)) return null
  return {
    id: event.id,
    ...date,
    title: event.title,
    time: new Intl.DateTimeFormat('fa-IR', { hour: '2-digit', minute: '2-digit' }).format(new Date(event.start)),
    category: event.type === 'meeting' || event.type === 'deadline' ? event.type : 'customer',
  }
}

export default function CalendarPage() {
  const { serviceAvailable, loading, error, events, capabilities, displayCopy, createEvent, updateEvent, deleteEvent } = useCalendar()
  const location = useLocation()
  const navigate = useNavigate()
  const today = getCurrentJalaliDate()
  const { date: intentDate, view: intentView } = useMemo(
    () => resolveCalendarIntent(location.search, today),
    [location.search, today],
  )
  const [anchorDate, setAnchorDate] = useState<JalaliDate>(() => today ?? { year: 1400, month: 1, day: 1 })
  const [view, setView] = useState<View>('month')
  const [query, setQuery] = useState('')
  const [categories, setCategories] = useState<Category[]>(['meeting', 'deadline', 'test', 'customer'])
  const [showFilters, setShowFilters] = useState(true)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null | undefined>(undefined)
  const [eventForm, setEventForm] = useState<EventForm>(createEmptyEventForm)
  const [eventError, setEventError] = useState('')
  const canCreateEvent = serviceAvailable && !loading && capabilities.canCreateEvent && Boolean(createEvent)

  useEffect(() => {
    if (intentDate) {
      // The URL is an external, one-time navigation intent; filter state remains untouched.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnchorDate(intentDate)
    }

    if (intentView) {
      setView(intentView)
    }
  }, [intentDate, intentView])

  const normalizedQuery = query.trim().toLocaleLowerCase('fa')
  const calendarUiEvents = useMemo(() => events.map(toCalendarUiEvent).filter((event): event is CalendarUiEvent => event !== null), [events])
  const filteredEvents = useMemo(() => calendarUiEvents.filter((event) => (
    categories.includes(event.category)
    && event.title.toLocaleLowerCase('fa').includes(normalizedQuery)
  )), [calendarUiEvents, categories, normalizedQuery])
  const { year, month, day: selectedDay } = anchorDate
  const visibleEvents = filteredEvents.filter(event => event.year === year && event.month === month)
  const selectedDate = anchorDate
  const selectedDayEvents = filteredEvents.filter(event => sameJalaliDate(event, selectedDate))
  const weekStart = shiftJalaliDate(selectedDate, -((jalaliMonthStartOffset(year, month) + selectedDay - 1) % 7))
  const selectedWeek = Array.from({ length: 7 }, (_, index) => shiftJalaliDate(weekStart, index))

  const moveAnchor = (offset: number) => setAnchorDate((current) => (
    view === 'day' ? shiftJalaliDate(current, offset)
      : view === 'week' ? shiftJalaliDate(current, offset * 7)
        : shiftJalaliMonth(current, offset)
  ))
  const selectDay = (day: number) => setAnchorDate((current) => ({ ...current, day }))
  const changeMiniCalendarMonth = (offset: number) => setAnchorDate((current) => shiftJalaliMonth(current, offset))

  const toggleCategory = (category: Category) => setCategories(current => current.includes(category) ? current.filter(item => item !== category) : [...current, category])
  const openEventForm = (event: CalendarEvent | null) => {
    setEventError('')
    setEventForm(createEventForm(event))
    setEditingEvent(event)
  }
  const saveEvent = async () => {
    const input = {
      title: eventForm.title.trim(), description: eventForm.description.trim() || undefined,
      start: toCalendarDateTime(eventForm.startDate, eventForm.startTime), end: toCalendarDateTime(eventForm.endDate, eventForm.endTime), allDay: false,
      projectId: null, type: eventForm.type, status: editingEvent?.status ?? 'scheduled', participants: editingEvent?.participants ?? [], location: eventForm.location.trim() || undefined,
    }
    if (!input.title || !input.start || !input.end) { setEventError('عنوان، تاریخ و ساعت شروع و پایان لازم است.'); return }
    if (input.end < input.start) { setEventError('زمان پایان نمی‌تواند پیش از زمان شروع باشد.'); return }
    const result = editingEvent ? await updateEvent?.(editingEvent.id, input) : await createEvent?.(input)
    if (!result?.ok) { setEventError(result?.message ?? displayCopy.actionUnavailable); return }
    setEventError(''); setEditingEvent(undefined)
  }

  return <div dir="rtl" className="space-y-3.5 pb-4">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-xl font-extrabold text-foreground">تقویم</h1><p className="mt-1 text-xs text-muted-foreground">مشاهده وظایف و رویدادها</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-52"><Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="جستجوی رویداد..." className="h-9 w-full rounded-xl border border-border/65 bg-surface-inset pe-9 ps-3 text-[10px] text-foreground outline-none focus:border-primary/45" /></div>
        <span title={canCreateEvent ? undefined : displayCopy.actionUnavailable} className={!canCreateEvent ? 'cursor-not-allowed' : ''}>
          <button type="button" disabled={!canCreateEvent} onClick={() => openEventForm(null)} className="app-action"><Plus className="h-4 w-4" />افزودن رویداد</button>
        </span>
      </div>
    </header>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setShowFilters(current => !current)} aria-expanded={showFilters} className="inline-flex h-9 items-center gap-2 rounded-xl border border-border/70 bg-surface-interactive px-3 text-[10px] text-foreground"><ListFilter className="h-4 w-4" />فیلترها</button>
        {showFilters && <>
          <button onClick={() => setCategories(['meeting', 'deadline', 'test', 'customer'])} className="inline-flex h-9 items-center gap-2 rounded-xl border border-border/70 bg-surface-interactive px-4 text-[10px]"><span className="h-2 w-2 rounded-full bg-primary" />همه</button>
          {(Object.keys(categoryMeta) as Category[]).map(category => <button key={category} onClick={() => toggleCategory(category)} className={`inline-flex h-9 items-center gap-2 rounded-xl border px-4 text-[10px] transition ${categories.includes(category) ? 'border-border/70 bg-surface-interactive text-foreground' : 'border-border/40 bg-transparent text-muted-foreground opacity-55'}`}><span className={`h-2 w-2 rounded-full ${categoryMeta[category].dot}`} />{categoryMeta[category].label}</button>)}
        </>}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex rounded-xl border border-border/70 bg-surface-inset p-1">{(['day', 'week', 'month'] as View[]).map(item => <button key={item} onClick={() => setView(item)} className={`h-7 rounded-lg px-4 text-[10px] transition ${view === item ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground'}`}>{item === 'day' ? 'روز' : item === 'week' ? 'هفته' : 'ماه'}</button>)}</div>
        <MonthNavigation view={view} date={anchorDate} onPrevious={() => moveAnchor(-1)} onNext={() => moveAnchor(1)} />
      </div>
    </div>

    <div dir="ltr" className="grid gap-3.5 xl:grid-cols-[350px_minmax(0,1fr)]">
      <aside dir="rtl" className="space-y-3">
        <section className="rounded-xl border border-border/70 bg-card/75 p-3 shadow-[0_12px_30px_hsl(var(--depth-shadow)/.16)]">
          <div className="flex items-center justify-between"><h2 className="text-xs font-bold">برنامه امروز</h2><span className="text-[10px] text-muted-foreground">{toPersianDigits(selectedDay)} {months[month]} {toPersianDigits(year)}</span></div>
          <div className="mt-3 space-y-2">{!serviceAvailable ? <p className="text-[10px] text-muted-foreground">{error ?? displayCopy.eventsUnavailable}</p> : selectedDayEvents.map(item => <div key={item.id} className="group flex items-center gap-2 rounded-lg border border-border/45 bg-surface-interactive/65 p-2 transition hover:border-border"><span className={`grid h-10 w-10 place-items-center rounded-lg border ${categoryMeta[item.category].chip} [&>svg]:h-5 [&>svg]:w-5`}>{item.category === 'meeting' ? <UsersRound /> : item.category === 'test' ? <Bug /> : <CircleUserRound />}</span><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold">{item.title}</p><p className="mt-1 text-[9px] text-muted-foreground">{categoryMeta[item.category].label}</p></div><time className="text-[9px] font-medium text-muted-foreground">{item.time}</time>{events.find(event => event.id === item.id) && <button type="button" onClick={() => openEventForm(events.find(event => event.id === item.id) ?? null)} className="text-[9px] text-primary">ویرایش</button>}<button type="button" onClick={() => void deleteEvent?.(item.id)} className="text-[9px] text-destructive">حذف</button></div>)}</div>
          <button type="button" onClick={() => navigate('/calendar?view=day&date=today')} className="mt-3 w-full text-center text-[10px] text-primary">مشاهده همه رویدادهای امروز</button>
        </section>

        <section className="rounded-xl border border-border/70 bg-card/75 p-3">
          <h2 className="text-xs font-bold">خلاصه این ماه</h2>
          <div className="mt-3 grid grid-cols-4 gap-2">{[
            ['تکمیل‌شده', events.filter(event => event.status === 'completed').length, <CheckCircle2 className="text-emerald-400" />], ['کل رویدادها', events.length, <CalendarDays className="text-blue-400" />], ['ددلاین‌ها', events.filter(event => event.type === 'deadline').length, <Flag className="text-orange-400" />], ['جلسات', events.filter(event => event.type === 'meeting').length, <UsersRound className="text-primary" />],
          ].map(([label, value, icon]) => <div key={String(label)} className="rounded-lg border border-border/55 bg-surface-inset/70 p-2 text-center"><span className="mx-auto grid h-7 w-7 place-items-center rounded-md bg-secondary [&>svg]:h-4 [&>svg]:w-4">{icon}</span><b className="mt-2 block text-base">{toPersianDigits(Number(value))}</b><span className="block truncate text-[8px] text-muted-foreground">{label}</span></div>)}</div>
        </section>

        <MiniCalendar month={month} year={year} selectedDay={selectedDay} onSelect={selectDay} onPrevious={() => changeMiniCalendarMonth(-1)} onNext={() => changeMiniCalendarMonth(1)} />
      </aside>

      <section dir="rtl" className="min-w-0 rounded-xl border border-border/70 bg-card/75 p-3 shadow-[0_14px_36px_hsl(var(--depth-shadow)/.18)]">
        {!serviceAvailable ? <div className="grid min-h-[420px] place-items-center text-center text-xs text-muted-foreground"><div><h2 className="font-bold text-foreground">{displayCopy.serviceUnavailable}</h2><p className="mt-2">{error ?? displayCopy.eventsUnavailable}</p></div></div> : view === 'month' ? <>
          <div className="grid grid-cols-7 overflow-hidden rounded-t-xl border border-border/65 bg-surface-interactive/70">{weekdays.map(day => <div key={day} className="px-2 py-3 text-center text-[10px] font-bold text-muted-foreground">{day}</div>)}</div>
          <MonthGrid events={visibleEvents} year={year} month={month} selectedDay={selectedDay} onSelect={selectDay} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 px-1"><div className="flex flex-wrap gap-4">{(Object.keys(categoryMeta) as Category[]).map(category => <span key={category} className="flex items-center gap-1.5 text-[9px] text-muted-foreground"><span className={`h-2 w-2 rounded-full ${categoryMeta[category].dot}`} />{categoryMeta[category].label}</span>)}</div><button onClick={() => setView('week')} className="inline-flex h-8 items-center gap-2 rounded-lg border border-border/60 bg-surface-interactive px-3 text-[9px] text-muted-foreground"><CalendarDays className="h-3.5 w-3.5" />مشاهده به صورت هفته</button></div>
        </> : view === 'day' ? <DayView date={selectedDate} events={selectedDayEvents} /> : <WeekView dates={selectedWeek} events={filteredEvents} />}
      </section>
    </div>
    <Dialog open={editingEvent !== undefined} onOpenChange={(open) => !open && setEditingEvent(undefined)}>
      <DialogContent dir="rtl" className="text-right"><DialogHeader className="text-right sm:text-right"><DialogTitle>{editingEvent ? 'ویرایش رویداد' : 'افزودن رویداد'}</DialogTitle><DialogDescription className="text-right">رویداد فقط در حافظهٔ همین نشست نگهداری می‌شود.</DialogDescription></DialogHeader>
        <form className="space-y-3 text-right" onSubmit={(event) => { event.preventDefault(); void saveEvent() }}>
          <input required value={eventForm.title} onChange={(event) => setEventForm((current) => ({ ...current, title: event.target.value }))} placeholder="عنوان رویداد" className="h-10 w-full rounded-lg border border-border bg-surface-inset px-3 text-right text-sm" />
          <textarea value={eventForm.description} onChange={(event) => setEventForm((current) => ({ ...current, description: event.target.value }))} placeholder="توضیحات (اختیاری)" className="min-h-20 w-full rounded-lg border border-border bg-surface-inset p-3 text-right text-sm" />
          {eventForm.type === 'meeting' && <input value={eventForm.location} onChange={(event) => setEventForm((current) => ({ ...current, location: event.target.value }))} placeholder="محل جلسه (اختیاری)" className="h-10 w-full rounded-lg border border-border bg-surface-inset px-3 text-right text-sm" />}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-medium text-foreground"><span>شروع</span><JalaliDatePicker value={eventForm.startDate || null} onChange={(startDate) => setEventForm((current) => ({ ...current, startDate }))} /><input type="time" required value={eventForm.startTime} onChange={(event) => setEventForm((current) => ({ ...current, startTime: event.target.value }))} aria-label="ساعت شروع" className="h-10 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm" /></label>
            <label className="space-y-1.5 text-xs font-medium text-foreground"><span>پایان</span><JalaliDatePicker value={eventForm.endDate || null} onChange={(endDate) => setEventForm((current) => ({ ...current, endDate }))} /><input type="time" required value={eventForm.endTime} onChange={(event) => setEventForm((current) => ({ ...current, endTime: event.target.value }))} aria-label="ساعت پایان" className="h-10 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm" /></label>
          </div>
          <select value={eventForm.type} onChange={(event) => setEventForm((current) => ({ ...current, type: event.target.value as CalendarEvent['type'] }))} className="h-10 w-full rounded-lg border border-border bg-surface-inset px-3 text-sm"><option value="meeting">جلسه</option><option value="deadline">ددلاین</option><option value="reminder">یادآوری</option><option value="milestone">نقطه عطف</option><option value="other">سایر</option></select>
          {eventError && <p className="text-xs text-destructive">{eventError}</p>}<DialogFooter><button type="button" onClick={() => setEditingEvent(undefined)} className="rounded-lg border border-border px-4 py-2 text-sm">انصراف</button><button type="submit" className="app-action">ذخیره</button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
}

function MonthNavigation({ view, date, onPrevious, onNext }: { view: View; date: JalaliDate; onPrevious: () => void; onNext: () => void }) {
  const label = view === 'day' ? `${toPersianDigits(date.day)} ${months[date.month]} ${toPersianDigits(date.year)}` : view === 'week' ? `هفتهٔ ${toPersianDigits(date.day)} ${months[date.month]}` : `${months[date.month]} ${toPersianDigits(date.year)}`
  const unit = view === 'day' ? 'روز' : view === 'week' ? 'هفته' : 'ماه'
  return <div className="flex h-9 min-w-56 items-center justify-between rounded-xl border border-border/70 bg-surface-inset px-2"><button type="button" onClick={onNext} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-secondary" aria-label={`${unit} بعد`}><ChevronRight className="h-4 w-4" /></button><b className="text-[10px]">{label}</b><button type="button" onClick={onPrevious} className="grid h-7 w-7 place-items-center rounded-lg hover:bg-secondary" aria-label={`${unit} قبل`}><ChevronLeft className="h-4 w-4" /></button></div>
}

function MonthGrid({ events, year, month, selectedDay, onSelect }: { events: CalendarUiEvent[]; year: number; month: number; selectedDay: number; onSelect: (day: number) => void }) {
  const daysInMonth = jalaliDaysInMonth(year, month)
  const startOffset = jalaliMonthStartOffset(year, month)
  const cells = Array.from({ length: Math.ceil((startOffset + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - startOffset + 1
    return { day, current: day >= 1 && day <= daysInMonth }
  })
  return <div className="grid grid-cols-7 overflow-hidden rounded-b-xl border-x border-b border-border/65">{cells.map((cell, index) => {
    const dayEvents = cell.current ? events.filter(event => event.day === cell.day) : []
    const selected = cell.current && cell.day === selectedDay
    return <button key={index} onClick={() => cell.current && onSelect(cell.day)} className="min-h-[112px] border-b border-e border-border/50 p-2 text-start transition hover:bg-secondary/20 last:border-e-0">
      <span className={`grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold ${selected ? 'border border-primary bg-primary/15 text-primary' : cell.current ? 'text-foreground' : 'text-muted-foreground/40'}`}>{toPersianDigits(cell.day)}</span>
      <div className="mt-1.5 space-y-1">{dayEvents.slice(0, 1).map(event => <div key={`${event.day}-${event.title}`} className={`flex items-center justify-between gap-1 rounded-md border px-2 py-1.5 text-[8px] ${categoryMeta[event.category].chip}`}><span className="truncate font-semibold">{event.title}</span><time className="shrink-0">{event.time}</time></div>)}{dayEvents.length > 1 && <p className="px-1 text-[8px] text-muted-foreground">+ {toPersianDigits(dayEvents.length - 1)} رویداد دیگر</p>}</div>
    </button>
  })}</div>
}

function CalendarEventCard({ event }: { event: CalendarUiEvent }) {
  return <div className="flex items-center gap-2 rounded-lg border border-border/45 bg-surface-interactive/65 p-2"><span className={`grid h-9 w-9 place-items-center rounded-lg border ${categoryMeta[event.category].chip} [&>svg]:h-4 [&>svg]:w-4`}>{event.category === 'meeting' ? <UsersRound /> : event.category === 'test' ? <Bug /> : <CircleUserRound />}</span><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-bold">{event.title}</p><p className="mt-1 text-[9px] text-muted-foreground">{categoryMeta[event.category].label}</p></div><time className="text-[9px] font-medium text-muted-foreground">{event.time}</time></div>
}

function DayView({ date, events }: { date: JalaliDate; events: CalendarUiEvent[] }) {
  return <div className="min-h-[420px] p-3"><div className="flex items-center justify-between border-b border-border/60 pb-3"><h2 className="text-sm font-bold text-foreground">نمای روز</h2><span className="text-xs text-muted-foreground">{toPersianDigits(date.day)} {months[date.month]} {toPersianDigits(date.year)}</span></div><div className="mt-3 space-y-2">{events.length ? events.map(event => <CalendarEventCard key={`${event.year}-${event.month}-${event.day}-${event.title}`} event={event} />) : <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-border/70 bg-surface-inset/50 text-center text-xs text-muted-foreground">رویدادی برای این روز وجود ندارد.</div>}</div></div>
}

function WeekView({ dates, events }: { dates: JalaliDate[]; events: CalendarUiEvent[] }) {
  return <div className="min-h-[420px]"><div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">{dates.map((date, index) => {
    const dayEvents = events.filter(event => sameJalaliDate(event, date))
    return <section key={`${date.year}-${date.month}-${date.day}`} className="min-h-40 rounded-xl border border-border/60 bg-surface-interactive/45 p-2"><div className="border-b border-border/50 pb-2 text-center"><p className="text-[10px] font-bold text-foreground">{weekdays[index]}</p><p className="mt-1 text-[9px] text-muted-foreground">{toPersianDigits(date.day)} {months[date.month]}</p></div><div className="mt-2 space-y-1.5">{dayEvents.length ? dayEvents.map(event => <CalendarEventCard key={`${event.year}-${event.month}-${event.day}-${event.title}`} event={event} />) : <p className="py-3 text-center text-[9px] text-muted-foreground">بدون رویداد</p>}</div></section>
  })}</div></div>
}

function MiniCalendar({ month, year, selectedDay, onSelect, onPrevious, onNext }: { month: number; year: number; selectedDay: number; onSelect: (day: number) => void; onPrevious: () => void; onNext: () => void }) {
  const daysInMonth = jalaliDaysInMonth(year, month)
  const startOffset = jalaliMonthStartOffset(year, month)
  const cells = Array.from({ length: Math.ceil((startOffset + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - startOffset + 1
    return { day, current: day >= 1 && day <= daysInMonth }
  })

  return <section className="rounded-xl border border-border/70 bg-card/75 p-3"><div className="flex items-center justify-between"><button onClick={onNext}><ChevronRight className="h-4 w-4 text-muted-foreground" /></button><b className="text-[10px]">{months[month]} {toPersianDigits(year)}</b><button onClick={onPrevious}><ChevronLeft className="h-4 w-4 text-muted-foreground" /></button></div><div className="mt-3 grid grid-cols-7 gap-y-2 text-center text-[8px] text-muted-foreground">{['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map(day => <b key={day}>{day}</b>)}{cells.map((cell, index) => <button key={index} disabled={!cell.current} onClick={() => cell.current && onSelect(cell.day)} className={`mx-auto grid h-6 w-6 place-items-center rounded-full ${cell.current && cell.day === selectedDay ? 'bg-primary text-primary-foreground' : cell.current ? 'text-foreground hover:bg-secondary' : 'text-transparent'}`}>{cell.current ? toPersianDigits(cell.day) : '۰'}</button>)}</div></section>
}
