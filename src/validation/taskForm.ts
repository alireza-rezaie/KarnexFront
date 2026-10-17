import { z } from 'zod'
import { parseIsoDate } from '@/utils/jalaliDate'

export const taskFormSchema = (statusIds: string[]) => z.object({
  type: z.enum(['task', 'story', 'bug', 'epic']),
  title: z.string().trim().min(1, 'عنوان وظیفه الزامی است'),
  description: z.string(),
  status: z.string().refine((value) => statusIds.includes(value), 'وضعیت معتبر انتخاب کنید'),
  priority: z.enum(['highest', 'high', 'medium', 'low', 'lowest']),
  assignee: z.string(),
  storyPoints: z.number().positive('Story Point باید عددی مثبت باشد').optional(),
  estimatedHours: z.number().positive('زمان تخمینی باید عددی مثبت باشد').optional(),
  sprintId: z.string(),
  dueDate: z.string().trim().optional().refine(
    (value) => value === undefined || value === '' || parseIsoDate(value) !== undefined,
    'تاریخ سررسید معتبر نیست',
  ),
})

export type TaskFormValues = z.infer<ReturnType<typeof taskFormSchema>>
