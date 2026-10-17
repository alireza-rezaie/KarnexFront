import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AuthenticatedTestProvider } from '@/test/AuthTestProvider'
import { CurrentUserProvider } from '@/contexts/CurrentUserContext'
import { MembersProvider } from '@/contexts/MembersContext'
import SettingsPage from '@/pages/SettingsPage'

function ProfileRuntime() {
  return <AuthenticatedTestProvider userId="m1"><MembersProvider><CurrentUserProvider><MemoryRouter initialEntries={['/settings']}><SettingsPage /></MemoryRouter></CurrentUserProvider></MembersProvider></AuthenticatedTestProvider>
}

describe('Profile avatar runtime save', () => {
  it('saves only the selected avatar ID and retains it while the session providers remain mounted', async () => {
    const { rerender } = render(<ProfileRuntime />)

    fireEvent.click(screen.getByRole('button', { name: 'آواتار ۸' }))
    fireEvent.click(screen.getByRole('button', { name: 'ذخیره تغییرات' }))

    await waitFor(() => {
      expect(document.querySelector('.hero-avatar img')?.getAttribute('src')).toContain('seed=fatemeh')
    })
    expect(screen.getByText('تغییرات پروفایل ذخیره شد')).toBeTruthy()

    rerender(<ProfileRuntime />)
    expect(document.querySelector('.hero-avatar img')?.getAttribute('src')).toContain('seed=fatemeh')
  })
})
