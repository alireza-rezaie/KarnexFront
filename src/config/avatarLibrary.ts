export type AvatarDefinition = { id: `avatar-${string}`; src: string; label: string }

/** Static product artwork. Labels identify artwork only, never a user. */
export const avatarLibrary: readonly AvatarDefinition[] = [
  { id: 'avatar-01', src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ali', label: 'آواتار ۱' },
  { id: 'avatar-02', src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=sara', label: 'آواتار ۲' },
  { id: 'avatar-03', src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=reza', label: 'آواتار ۳' },
  { id: 'avatar-04', src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=maryam', label: 'آواتار ۴' },
  { id: 'avatar-05', src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=hossein', label: 'آواتار ۵' },
  { id: 'avatar-06', src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=niloofar', label: 'آواتار ۶' },
  { id: 'avatar-07', src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=amir', label: 'آواتار ۷' },
  { id: 'avatar-08', src: 'https://api.dicebear.com/7.x/avataaars/svg?seed=fatemeh', label: 'آواتار ۸' },
] as const

export function getAvatarById(avatarId: string | null | undefined) {
  return avatarLibrary.find((avatar) => avatar.id === avatarId)
}
