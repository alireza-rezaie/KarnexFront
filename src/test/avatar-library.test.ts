import { describe, expect, it } from 'vitest'
import { avatarLibrary, getAvatarById } from '@/config/avatarLibrary'

describe('built-in avatar library', () => {
  it('contains the eight recovered DiceBear artworks with unique stable ids', () => {
    expect(avatarLibrary).toHaveLength(8)
    expect(new Set(avatarLibrary.map((avatar) => avatar.id)).size).toBe(8)
    expect(avatarLibrary.map((avatar) => avatar.id)).toEqual([
      'avatar-01', 'avatar-02', 'avatar-03', 'avatar-04',
      'avatar-05', 'avatar-06', 'avatar-07', 'avatar-08',
    ])
    expect(avatarLibrary.every((avatar) => avatar.src.startsWith('https://api.dicebear.com/7.x/avataaars/svg?seed='))).toBe(true)
  })

  it('resolves only known ids and never selects a fallback artwork', () => {
    expect(getAvatarById('avatar-04')?.id).toBe('avatar-04')
    expect(getAvatarById(null)).toBeUndefined()
    expect(getAvatarById('unknown-avatar')).toBeUndefined()
  })
})
