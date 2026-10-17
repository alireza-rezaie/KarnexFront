export const priorityConfig = {
  highest: { label: 'بحرانی', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', icon: 'chevrons-up' },
  high: { label: 'بالا', color: '#f97316', bgColor: 'rgba(249, 115, 22, 0.15)', icon: 'chevron-up' },
  medium: { label: 'متوسط', color: '#eab308', bgColor: 'rgba(234, 179, 8, 0.15)', icon: 'minus' },
  low: { label: 'پایین', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)', icon: 'chevron-down' },
  lowest: { label: 'خیلی پایین', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)', icon: 'chevrons-down' },
} as const

export const typeConfig = {
  epic: { label: 'اپیک', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)', icon: 'layers' },
  story: { label: 'استوری', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)', icon: 'book-open' },
  task: { label: 'تسک', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)', icon: 'check-square' },
  bug: { label: 'باگ', color: '#ef4444', bgColor: 'rgba(239, 68, 68, 0.15)', icon: 'bug' },
  subtask: { label: 'ساب‌تسک', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.15)', icon: 'git-branch' },
} as const
