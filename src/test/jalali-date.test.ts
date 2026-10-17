import { describe, expect, it } from 'vitest'
import {
  normalizeJalaliDateDigits,
  isoToJalaliDate,
  jalaliToIsoDate,
  parseJalaliDate,
  toCanonicalIsoDate,
  toJalaliComparableDate,
} from '@/utils/jalaliDate'

describe('jalaliDate', () => {
  it.each([
    ['1403/7/2', '1403/7/2'],
    ['۱۴۰۳/۷/۲', '1403/7/2'],
    ['١٤٠٣/٧/٢', '1403/7/2'],
  ])('normalizes %s to ASCII digits', (value, expected) => {
    expect(normalizeJalaliDateDigits(value)).toBe(expected)
    expect(parseJalaliDate(value)).toEqual({ year: 1403, month: 7, day: 2 })
  })

  it.each(['1403/7/2', '1403/07/2', '1403/7/02', '1403/07/02'])(
    'parses variable-width dates: %s',
    (value) => {
      expect(parseJalaliDate(value)).toEqual({ year: 1403, month: 7, day: 2 })
    },
  )

  it('rejects invalid months and day ranges', () => {
    expect(parseJalaliDate('1403/0/10')).toBeUndefined()
    expect(parseJalaliDate('1403/13/10')).toBeUndefined()
    expect(parseJalaliDate('1403/1/31')).toEqual({ year: 1403, month: 1, day: 31 })
    expect(parseJalaliDate('1403/1/32')).toBeUndefined()
    expect(parseJalaliDate('1403/7/30')).toEqual({ year: 1403, month: 7, day: 30 })
    expect(parseJalaliDate('1403/7/31')).toBeUndefined()
  })

  it('applies the existing Esfand leap-year calculation', () => {
    expect(parseJalaliDate('1403/12/30')).toEqual({ year: 1403, month: 12, day: 30 })
    expect(parseJalaliDate('1402/12/30')).toBeUndefined()
    expect(parseJalaliDate('1402/12/29')).toEqual({ year: 1402, month: 12, day: 29 })
  })

  it.each(['', 'abc', '1403', '1403/1', '1403/a/1'])('rejects malformed input: %s', (value) => {
    expect(parseJalaliDate(value)).toBeUndefined()
  })

  it('uses numeric chronology rather than lexical date ordering', () => {
    expect(toJalaliComparableDate('1403/10/2')).toBeGreaterThan(toJalaliComparableDate('1403/9/20')!)
    expect(toJalaliComparableDate('1404/1/1')).toBeGreaterThan(toJalaliComparableDate('1403/12/29')!)
  })

  it('returns undefined for an invalid comparable date', () => {
    expect(toJalaliComparableDate('not-a-date')).toBeUndefined()
  })

  it('converts canonical ISO dates without introducing a timezone shift', () => {
    expect(isoToJalaliDate('2024-03-20')).toEqual({ year: 1403, month: 1, day: 1 })
    expect(jalaliToIsoDate(1403, 1, 1)).toBe('2024-03-20')
    expect(isoToJalaliDate('not-a-date')).toBeUndefined()
  })

  it('normalizes legacy task dates to the canonical ISO contract while retaining comparable dates', () => {
    expect(toCanonicalIsoDate('1403/1/1')).toBe('2024-03-20')
    expect(toCanonicalIsoDate('2024-03-20')).toBe('2024-03-20')
    expect(toJalaliComparableDate('2024-03-20')).toBe(toJalaliComparableDate('1403/1/1'))
  })
})
