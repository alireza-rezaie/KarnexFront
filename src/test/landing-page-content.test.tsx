import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LandingPage from '@/pages/LandingPage'

const scrollIntoView = vi.fn()

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView })
})

afterEach(() => {
  cleanup()
  scrollIntoView.mockReset()
})

describe('landing page truthful content', () => {
  it('removes unsupported social proof and KPI claims', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)

    for (const text of ['ایرانسل', 'همراه اول', 'تپسی', 'دیوار', 'اسنپ!', 'دیجی‌کالا', 'مورد اعتماد سازمان‌های پیشرو', '۹۹.۹٪', '+۱۰,۰۰۰', '+۵,۰۰۰', '+۸,۰۰۰', '+۱M']) {
      expect(screen.queryByText(text)).toBeNull()
    }
  })

  it('labels preview data as illustrative and gives the preview CTA an accurate name', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)

    expect(screen.getByText('این پیش‌نمایش صرفاً برای نمایش رابط کاربری است و دادهٔ واقعی مشتری یا سازمان را نشان نمی‌دهد.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'مشاهده دمو' })).toBeNull()
    expect(screen.getAllByRole('button', { name: 'مشاهده امکانات' })).toHaveLength(2)
  })

  it('keeps the CTA scroll behavior targeted at features', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)

    fireEvent.click(screen.getAllByRole('button', { name: 'مشاهده امکانات' })[0]!)

    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth' })
  })
})
