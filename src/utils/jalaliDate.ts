export type JalaliDate = { year: number; month: number; day: number }

export type GregorianDate = { year: number; month: number; day: number }

export const normalizeJalaliDateDigits = (value: string) => value
  .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))

export const jalaliToGregorian = (jalaliYear: number, jalaliMonth: number, jalaliDay: number) => {
  const year = jalaliYear + 1595
  let days = -355668 + 365 * year + Math.floor(year / 33) * 8 + Math.floor(((year % 33) + 3) / 4) + jalaliDay + (jalaliMonth < 7 ? (jalaliMonth - 1) * 31 : (jalaliMonth - 7) * 30 + 186)
  let gregorianYear = 400 * Math.floor(days / 146097)
  days %= 146097
  if (days > 36524) {
    gregorianYear += 100 * Math.floor(--days / 36524)
    days %= 36524
    if (days >= 365) days++
  }
  gregorianYear += 4 * Math.floor(days / 1461)
  days %= 1461
  if (days > 365) {
    gregorianYear += Math.floor((days - 1) / 365)
    days = (days - 1) % 365
  }
  const monthDays = [31, gregorianYear % 4 === 0 && (gregorianYear % 100 !== 0 || gregorianYear % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  let gregorianMonth = 0
  while (days >= monthDays[gregorianMonth]) days -= monthDays[gregorianMonth++]

  return { year: gregorianYear, month: gregorianMonth + 1, day: days + 1 }
}

export const gregorianToJalali = (gregorianYear: number, gregorianMonth: number, gregorianDay: number): JalaliDate | undefined => {
  const date = new Date(Date.UTC(gregorianYear, gregorianMonth - 1, gregorianDay))
  if (date.getUTCFullYear() !== gregorianYear || date.getUTCMonth() + 1 !== gregorianMonth || date.getUTCDate() !== gregorianDay) return undefined

  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date)
  const readPart = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  const year = readPart('year')
  const month = readPart('month')
  const day = readPart('day')

  return jalaliDaysInMonth(year, month) >= day ? { year, month, day } : undefined
}

export const parseIsoDate = (value: string | null | undefined): GregorianDate | undefined => {
  if (!value) return undefined
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return undefined
  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
    ? { year, month, day }
    : undefined
}

export const jalaliToIsoDate = (year: number, month: number, day: number) => {
  if (day < 1 || day > jalaliDaysInMonth(year, month)) return undefined
  const gregorian = jalaliToGregorian(year, month, day)
  return `${String(gregorian.year).padStart(4, '0')}-${String(gregorian.month).padStart(2, '0')}-${String(gregorian.day).padStart(2, '0')}`
}

export const isoToJalaliDate = (value: string | null | undefined) => {
  const gregorian = parseIsoDate(value)
  return gregorian ? gregorianToJalali(gregorian.year, gregorian.month, gregorian.day) : undefined
}

export const jalaliDaysInMonth = (year: number, month: number) => {
  if (!Number.isInteger(year) || month < 1 || month > 12) return 0
  if (month <= 6) return 31
  if (month <= 11) return 30

  const currentYearStart = jalaliToGregorian(year, 1, 1)
  const nextYearStart = jalaliToGregorian(year + 1, 1, 1)
  const current = Date.UTC(currentYearStart.year, currentYearStart.month - 1, currentYearStart.day)
  const next = Date.UTC(nextYearStart.year, nextYearStart.month - 1, nextYearStart.day)
  return (next - current) / 86_400_000 === 366 ? 30 : 29
}

export const parseJalaliDate = (value: string | undefined): JalaliDate | undefined => {
  if (!value) return undefined

  const match = normalizeJalaliDateDigits(value.trim()).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (!match) return undefined

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const daysInMonth = jalaliDaysInMonth(year, month)
  if (year < 1 || !daysInMonth || day < 1 || day > daysInMonth) return undefined

  return { year, month, day }
}

/** Converts legacy Jalali text or a canonical ISO date to the ISO task-date contract. */
export const toCanonicalIsoDate = (value: string | null | undefined) => {
  const iso = parseIsoDate(value)
  if (iso && value) return value
  const jalali = parseJalaliDate(value ?? undefined)
  return jalali ? jalaliToIsoDate(jalali.year, jalali.month, jalali.day) : undefined
}

/** Reads either the current ISO task-date contract or legacy Jalali text for presentation and filtering. */
export const toJalaliDate = (value: string | null | undefined) => parseJalaliDate(value ?? undefined) ?? isoToJalaliDate(value)

export const formatJalaliDate = (value: string | null | undefined) => {
  const date = toJalaliDate(value)
  return date ? `${date.year}/${String(date.month).padStart(2, '0')}/${String(date.day).padStart(2, '0')}` : undefined
}

export const toJalaliComparableDate = (value: string | undefined) => {
  const date = toJalaliDate(value)
  return date ? date.year * 10_000 + date.month * 100 + date.day : undefined
}

export const getCurrentJalaliDate = (now = new Date()): JalaliDate | undefined => {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now)
  const readPart = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value)
  const year = readPart('year')
  const month = readPart('month')
  const day = readPart('day')
  const daysInMonth = jalaliDaysInMonth(year, month)

  return year > 0 && daysInMonth && day >= 1 && day <= daysInMonth
    ? { year, month, day }
    : undefined
}

export const getCurrentJalaliComparableDate = (now = new Date()) => {
  const date = getCurrentJalaliDate(now)
  return date ? date.year * 10_000 + date.month * 100 + date.day : undefined
}
