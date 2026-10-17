import { useEffect, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getCurrentJalaliDate, isoToJalaliDate, jalaliDaysInMonth, jalaliToGregorian, jalaliToIsoDate, type JalaliDate } from '@/utils/jalaliDate'
import { toPersianDigits } from '@/lib/persian-numbers'

const monthNames = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']
const weekdays = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

export type JalaliDatePickerProps = {
  value?: string | null
  onChange: (value: string) => void
  disabled?: boolean
  minDate?: string
  maxDate?: string
  placeholder?: string
  className?: string
}

const formatJalaliDate = (date: JalaliDate) => `${toPersianDigits(date.year)}/${toPersianDigits(String(date.month).padStart(2, '0'))}/${toPersianDigits(String(date.day).padStart(2, '0'))}`

const shiftMonth = (date: JalaliDate, offset: number): JalaliDate => {
  const total = date.year * 12 + date.month - 1 + offset
  return { year: Math.floor(total / 12), month: (total % 12) + 1, day: 1 }
}

const firstWeekday = (year: number, month: number) => {
  const gregorian = jalaliToGregorian(year, month, 1)
  return (new Date(Date.UTC(gregorian.year, gregorian.month - 1, gregorian.day)).getUTCDay() + 1) % 7
}

export function JalaliDatePicker({ value, onChange, disabled = false, minDate, maxDate, placeholder = 'انتخاب تاریخ', className }: JalaliDatePickerProps) {
  const selectedDate = isoToJalaliDate(value)
  const today = getCurrentJalaliDate() ?? { year: 1400, month: 1, day: 1 }
  const [open, setOpen] = useState(false)
  const [viewDate, setViewDate] = useState<JalaliDate>(selectedDate ?? today)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const dismiss = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === 'Escape') setOpen(false)
        return
      }
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', dismiss)
    document.addEventListener('keydown', dismiss)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      document.removeEventListener('keydown', dismiss)
    }
  }, [open])

  const openPicker = () => {
    if (disabled) return
    setViewDate(selectedDate ?? today)
    setOpen(true)
  }
  const isUnavailable = (iso: string) => (minDate !== undefined && iso < minDate) || (maxDate !== undefined && iso > maxDate)
  const dayCount = jalaliDaysInMonth(viewDate.year, viewDate.month)
  const leadingBlanks = firstWeekday(viewDate.year, viewDate.month)
  const displayValue = selectedDate ? formatJalaliDate(selectedDate) : placeholder

  return <div ref={rootRef} dir="rtl" className={cn('relative', className)}>
    <button type="button" disabled={disabled} onClick={openPicker} aria-haspopup="dialog" aria-expanded={open} className="flex h-10 w-full items-center justify-between gap-2 rounded-lg border border-border/70 bg-surface-inset px-3 text-right text-xs text-foreground shadow-[inset_0_1px_0_hsl(var(--foreground)/.025)] outline-none transition hover:border-primary/45 focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50">
      <span className={selectedDate ? '' : 'text-muted-foreground'}>{displayValue}</span>
      <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
    </button>

    {open && <section role="dialog" aria-label="انتخاب تاریخ جلالی" className="absolute z-50 mt-2 w-[min(21rem,calc(100vw-2rem))] rounded-xl border border-border/75 bg-popover p-3 text-foreground shadow-2xl">
      <header className="flex items-center justify-between gap-2">
        <button type="button" onClick={() => setViewDate((current) => shiftMonth(current, 1))} aria-label="ماه بعد" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"><ChevronRight className="size-4" /></button>
        <p className="text-sm font-bold">{monthNames[viewDate.month - 1]} {toPersianDigits(viewDate.year)}</p>
        <button type="button" onClick={() => setViewDate((current) => shiftMonth(current, -1))} aria-label="ماه قبل" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"><ChevronLeft className="size-4" /></button>
      </header>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">{weekdays.map((day) => <span key={day} className="grid h-8 place-items-center font-semibold">{day}</span>)}</div>
      <div className="grid grid-cols-7 gap-1" aria-label={`${monthNames[viewDate.month - 1]} ${toPersianDigits(viewDate.year)}`}>
        {Array.from({ length: leadingBlanks }).map((_, index) => <span key={`blank-${index}`} aria-hidden className="h-8" />)}
        {Array.from({ length: dayCount }, (_, index) => index + 1).map((day) => {
          const iso = jalaliToIsoDate(viewDate.year, viewDate.month, day)!
          const selected = value === iso
          const currentDay = today.year === viewDate.year && today.month === viewDate.month && today.day === day
          const unavailable = isUnavailable(iso)
          return <button key={day} type="button" disabled={unavailable} onClick={() => { onChange(iso); setOpen(false) }} aria-label={`${toPersianDigits(day)} ${monthNames[viewDate.month - 1]} ${toPersianDigits(viewDate.year)}`} aria-pressed={selected} className={cn('grid h-8 place-items-center rounded-lg text-[11px] transition focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-35', selected ? 'bg-primary text-primary-foreground shadow-sm' : currentDay ? 'border border-primary/50 text-primary hover:bg-primary/10' : 'hover:bg-secondary')}>{toPersianDigits(day)}</button>
        })}
      </div>

      <footer className="mt-3 flex justify-between border-t border-border/60 pt-3">
        <button type="button" onClick={() => setOpen(false)} className="rounded-md px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-secondary">بستن</button>
        <button type="button" onClick={() => { setViewDate(today); const iso = jalaliToIsoDate(today.year, today.month, today.day)!; if (!isUnavailable(iso)) { onChange(iso); setOpen(false) } }} className="rounded-md px-2 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/10">امروز</button>
      </footer>
    </section>}
  </div>
}
