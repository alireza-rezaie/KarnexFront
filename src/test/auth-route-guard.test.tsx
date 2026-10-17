import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import App from '@/App'

afterEach(cleanup)

describe('application auth route guard', () => {
  it('redirects direct dashboard access without a runtime session to login', async () => {
    render(<MemoryRouter initialEntries={['/dashboard']}><App /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: 'ورود به کارنکس' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: /سلام/ })).toBeNull()
  })

  it('preserves the login redirect for direct unauthenticated plans access', async () => {
    render(<MemoryRouter initialEntries={['/admin/plans']}><App /></MemoryRouter>)

    expect(await screen.findByRole('heading', { name: 'ورود به کارنکس' })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: 'مدیریت پلن‌ها' })).toBeNull()
  })
})
