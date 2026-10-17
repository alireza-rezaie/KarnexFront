export type NotificationFeedItem = {
  id: string
  title: string
  message: string
  time: string
  read: boolean
  type: 'task' | 'comment' | 'sprint' | 'file' | 'system'
}

export type NotificationFeedCopy = {
  unavailable: string
  empty: string
  loading: string
}
