import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JalaliDatePicker } from '@/components/JalaliDatePicker'

describe('JalaliDatePicker', () => {
  afterEach(cleanup)

  it('navigates Jalali months and returns the selected canonical ISO date', () => {
    const onChange = vi.fn()
    render(<JalaliDatePicker value="2024-03-20" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /۱۴۰۳\/۰۱\/۰۱/ }))
    expect(screen.getByRole('dialog', { name: 'انتخاب تاریخ جلالی' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'ماه بعد' }))
    expect(screen.getByText('اردیبهشت ۱۴۰۳')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'ماه قبل' }))
    fireEvent.click(screen.getByRole('button', { name: '۲ فروردین ۱۴۰۳' }))

    expect(onChange).toHaveBeenCalledWith('2024-03-21')
    expect(screen.queryByRole('dialog', { name: 'انتخاب تاریخ جلالی' })).toBeNull()
  })

  it('closes with Escape without changing the controlled value', () => {
    const onChange = vi.fn()
    render(<JalaliDatePicker value="2024-03-20" onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /۱۴۰۳\/۰۱\/۰۱/ }))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'انتخاب تاریخ جلالی' })).toBeNull()
    expect(onChange).not.toHaveBeenCalled()
  })
})
