import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { NotificationFeedCopy, NotificationFeedItem } from '@/types/notificationFeed'

type NotificationFeedContextValue = {
  notifications: NotificationFeedItem[]
  unreadCount: number
  loading: boolean
  serviceAvailable: boolean
  canMarkAsRead: boolean
  canMarkAllAsRead: boolean
  feedCopy: NotificationFeedCopy
  markAsRead?: (notificationId: NotificationFeedItem['id']) => void | Promise<boolean>
  markAllAsRead?: () => void | Promise<boolean>
}

const fallbackNotifications: NotificationFeedItem[] = []

const fallbackCopy: NotificationFeedCopy = {
  unavailable: 'اعلان‌ها پس از اتصال سرویس اعلان‌ها نمایش داده می‌شوند.',
  empty: 'اعلانی برای نمایش وجود ندارد.',
  loading: 'در حال دریافت اعلان‌ها…',
}

const NotificationFeedContext = createContext<NotificationFeedContextValue | undefined>(undefined)

export function NotificationFeedProvider({ children }: { children: ReactNode }) {
  // The fallback deliberately has no feed data or mutation handlers until a backend-backed provider supplies them.
  const serviceAvailable = false
  const loading = false
  const notifications = fallbackNotifications

  const value = useMemo<NotificationFeedContextValue>(() => ({
    notifications,
    unreadCount: notifications.filter((notification) => !notification.read).length,
    loading,
    serviceAvailable,
    canMarkAsRead: false,
    canMarkAllAsRead: false,
    feedCopy: fallbackCopy,
  }), [notifications, loading, serviceAvailable])

  return <NotificationFeedContext.Provider value={value}>{children}</NotificationFeedContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotificationFeed() {
  const context = useContext(NotificationFeedContext)

  if (!context) {
    throw new Error('useNotificationFeed must be used within a NotificationFeedProvider.')
  }

  return context
}
