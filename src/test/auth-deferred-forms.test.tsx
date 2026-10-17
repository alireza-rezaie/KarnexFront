import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import LoginPage from '@/pages/LoginPage'
import OTPPage from '@/pages/OTPPage'
import RegisterPage from '@/pages/RegisterPage'
import { AuthProvider } from '@/contexts/AuthContext'

function LocationOutput() {
  const location = useLocation()

  return <output data-testid="route">{location.pathname}</output>
}

function renderAuthRoute(path: '/login' | '/register' | '/otp') {
  render(<AuthProvider><MemoryRouter initialEntries={[path]}><LocationOutput /><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/otp" element={<OTPPage />} />
  </Routes></MemoryRouter></AuthProvider>)
}

afterEach(cleanup)

describe('backend-deferred authentication forms', () => {
  it('keeps login and registration honestly disabled without navigating into a fake OTP flow', () => {
    renderAuthRoute('/login')
    expect(screen.getByRole('button', { name: 'ورود' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('route').textContent).toBe('/login')

    cleanup()
    renderAuthRoute('/register')
    expect(screen.getByRole('button', { name: 'ثبت‌نام' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('route').textContent).toBe('/register')
  })

  it('does not auto-submit or verify a locally entered OTP', () => {
    renderAuthRoute('/otp')
    const inputs = screen.getAllByRole('textbox')
    inputs.forEach((input, index) => fireEvent.change(input, { target: { value: String(index + 1) } }))

    expect(screen.getByRole('button', { name: 'تأیید و ادامه' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByTestId('route').textContent).toBe('/otp')
  })
})
