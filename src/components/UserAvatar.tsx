import { useState } from 'react'
import { getAvatarById } from '@/config/avatarLibrary'
import { cn } from '@/lib/utils'

type UserAvatarProps = {
  avatarId?: string | null
  name?: string | null
  className?: string
}

/** Pure avatar renderer: profile data remains owned by the calling context. */
export function UserAvatar({ avatarId, name, className }: UserAvatarProps) {
  const avatar = getAvatarById(avatarId)
  const [failedAvatarId, setFailedAvatarId] = useState<string | null>(null)
  const initials = (name?.trim() || '?').slice(0, 2)
  if (avatar && failedAvatarId !== avatar.id) return <img src={avatar.src} alt={name || avatar.label} className={cn('rounded-full object-cover', className)} onError={() => setFailedAvatarId(avatar.id)} />
  return <span role="img" aria-label={name ? `آواتار ${name}` : 'آواتار پیش‌فرض'} className={cn('inline-grid shrink-0 place-items-center rounded-full bg-secondary text-[0.65em] font-medium text-muted-foreground', className)}>{initials}</span>
}
