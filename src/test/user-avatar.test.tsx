import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { UserAvatar } from '@/components/UserAvatar'

describe('UserAvatar', () => {
  it('renders the library artwork for a known avatar id', () => {
    render(<UserAvatar avatarId="avatar-01" name="کاربر" />)
    expect(screen.getByRole('img', { name: 'کاربر' }).getAttribute('src')).toContain('seed=ali')
  })

  it('renders readable neutral initials for missing or unknown ids', () => {
    const { rerender } = render(<UserAvatar name="آوا" />)
    expect(screen.getByRole('img', { name: 'آواتار آوا' }).textContent).toBe('آو')
    rerender(<UserAvatar avatarId="unknown" name="کاربر" />)
    expect(screen.getByRole('img', { name: 'آواتار کاربر' }).textContent).toBe('کا')
  })

  it('falls back to initials without changing the avatar id when artwork fails to load', () => {
    const { container } = render(<UserAvatar avatarId="avatar-01" name="کاربر" />)
    fireEvent.error(container.querySelector('img')!)
    expect(container.querySelector('[role="img"]')?.textContent).toBe('کا')
  })
})
