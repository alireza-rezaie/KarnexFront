import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { priorityConfig } from '@/config/taskMetadata'
import { useCurrentUser } from '@/contexts/CurrentUserContext'
import { useMembers } from '@/contexts/MembersContext'
import { useProject } from '@/contexts/ProjectContext'
import { useProjectStatus } from '@/contexts/ProjectStatusContext'
import { useProjectTasks } from '@/contexts/ProjectTaskContext'
import { useSprints } from '@/contexts/SprintsContext'
import { getProjectMethodologyCapabilities } from '@/utils/projectMethodology'
import { taskFormSchema, type TaskFormValues } from '@/validation/taskForm'
import { JalaliDatePicker } from '@/components/JalaliDatePicker'

type CreateTaskDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const createTaskDefaultValues = (status: string): TaskFormValues => ({
  type: 'task',
  title: '',
  description: '',
  status,
  priority: 'medium',
  assignee: '',
  storyPoints: undefined,
  estimatedHours: undefined,
  sprintId: '',
  dueDate: '',
})

export function CreateTaskDialog({ open, onOpenChange }: CreateTaskDialogProps) {
  const { projectId, currentProject } = useProject()
  const [creating, setCreating] = useState(false)
  const [createInKanbanBacklog, setCreateInKanbanBacklog] = useState(false)
  const { members } = useMembers()
  const { currentMember } = useCurrentUser()
  const { statuses } = useProjectStatus()
  const { loading, error, capabilities, displayCopy, createTask } = useProjectTasks()
  const { sprints } = useSprints()
  const form = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema(statuses.map((status) => status.id))),
    defaultValues: createTaskDefaultValues(statuses[0]?.id ?? ''),
    mode: 'onChange',
  })
  const selectedTaskType = useWatch({ control: form.control, name: 'type' })
  const watchedTaskValues = useWatch({ control: form.control })
  const projectSprints = sprints.filter((sprint) => sprint.projectId === projectId)
  const methodology = getProjectMethodologyCapabilities(currentProject?.type)
  const canCreateTask = Boolean(projectId && statuses.length > 0 && !loading && !creating && capabilities.canCreateTask && createTask)
  const canSubmitTask = canCreateTask && taskFormSchema(statuses.map((status) => status.id)).safeParse(watchedTaskValues).success

  useEffect(() => {
    if (open) {
      form.reset(createTaskDefaultValues(statuses[0]?.id ?? ''))
      setCreateInKanbanBacklog(false)
    }
  }, [form, open, statuses])

  const submitCreateTask = async (values: TaskFormValues) => {
    if (!createTask || !canCreateTask) return

    setCreating(true)
    try {
      const now = new Date().toLocaleDateString('fa-IR')
      const result = await createTask({
        key: `TASK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        title: values.title,
        description: values.description,
        type: values.type,
        status: values.status,
        priority: values.priority,
        assignee: values.assignee,
        reporter: currentMember?.id ?? '',
        sprintId: values.sprintId || undefined,
        inKanbanBacklog: methodology.boardWorkSelectionMode === 'continuous-flow' ? createInKanbanBacklog : undefined,
        labels: [],
        storyPoints: values.storyPoints,
        estimatedSeconds: values.estimatedHours ? values.estimatedHours * 3600 : undefined,
        dueDate: values.dueDate || undefined,
        createdAt: now,
        updatedAt: now,
        comments: 0,
        attachments: 0,
        subtasks: 0,
        completedSubtasks: 0,
      })
      if (!result.ok) {
        form.setError('root', { message: result.message ?? 'ایجاد وظیفه ناموفق بود.' })
        return
      }

      form.reset(createTaskDefaultValues(statuses[0]?.id ?? ''))
      onOpenChange(false)
    } finally {
      setCreating(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg mx-4 max-h-[80vh] overflow-y-auto">
        <h2 className="text-lg font-bold text-foreground mb-6">وظیفه جدید</h2>
        <form onSubmit={form.handleSubmit((values) => void submitCreateTask(values))} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">نوع</label>
            <div className="flex gap-2">
              {[
                { id: 'task', label: 'تسک' },
                { id: 'story', label: 'استوری' },
                { id: 'bug', label: 'باگ' },
                { id: 'epic', label: 'اپیک' },
              ].map((type) => (
                <button type="button" disabled={!canCreateTask} key={type.id} onClick={() => form.setValue('type', type.id as TaskFormValues['type'])} className={`flex-1 py-2 rounded-xl border text-xs transition-all disabled:cursor-not-allowed disabled:opacity-60 ${selectedTaskType === type.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-secondary text-muted-foreground hover:border-primary/50'}`}>
                  {type.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">عنوان</label>
            <input {...form.register('title')} disabled={!canCreateTask} aria-invalid={!!form.formState.errors.title} type="text" placeholder="عنوان وظیفه" className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm disabled:cursor-not-allowed disabled:opacity-60" />
            {form.formState.errors.title && <p className="mt-1 text-xs text-red-500">{form.formState.errors.title.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">توضیحات</label>
            <textarea {...form.register('description')} disabled={!canCreateTask} aria-invalid={!!form.formState.errors.description} placeholder="توضیحات..." rows={3} className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none disabled:cursor-not-allowed disabled:opacity-60" />
            {form.formState.errors.description && <p className="mt-1 text-xs text-red-500">{form.formState.errors.description.message}</p>}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">وضعیت</label>
              <select {...form.register('status')} disabled={!canCreateTask} aria-invalid={!!form.formState.errors.status} className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm disabled:cursor-not-allowed disabled:opacity-60">
                <option value="">انتخاب...</option>
                {statuses.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}
              </select>
              {form.formState.errors.status && <p className="mt-1 text-xs text-red-500">{form.formState.errors.status.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">اولویت</label>
              <select {...form.register('priority')} disabled={!canCreateTask} className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm disabled:cursor-not-allowed disabled:opacity-60">
                {Object.entries(priorityConfig).map(([value, priority]) => <option key={value} value={value}>{priority.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">مسئول</label>
              <select {...form.register('assignee')} disabled={!canCreateTask} aria-invalid={!!form.formState.errors.assignee} className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm disabled:cursor-not-allowed disabled:opacity-60">
                <option value="">انتخاب...</option>
                {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
              </select>
              {form.formState.errors.assignee && <p className="mt-1 text-xs text-red-500">{form.formState.errors.assignee.message}</p>}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {methodology.supportsSprints && <div>
              <label className="block text-sm font-medium text-foreground mb-2">اسپرینت</label>
              <select {...form.register('sprintId')} disabled={!canCreateTask} className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm disabled:cursor-not-allowed disabled:opacity-60">
                <option value="">بک‌لاگ</option>
                {projectSprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}
              </select>
            </div>}
            {methodology.boardWorkSelectionMode === 'continuous-flow' && <div>
              <label className="block text-sm font-medium text-foreground mb-2">محل کار</label>
              <select value={createInKanbanBacklog ? 'planning' : 'board'} onChange={event => setCreateInKanbanBacklog(event.target.value === 'planning')} disabled={!canCreateTask} className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm disabled:cursor-not-allowed disabled:opacity-60">
                <option value="board">جریان کانبان</option>
                <option value="planning">ناحیه برنامه‌ریزی</option>
              </select>
            </div>}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Story Point</label>
              <input {...form.register('storyPoints', { setValueAs: value => value === '' ? undefined : Number(value) })} disabled={!canCreateTask} aria-invalid={!!form.formState.errors.storyPoints} type="number" min="1" placeholder="۵" className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm disabled:cursor-not-allowed disabled:opacity-60" dir="ltr" />
              {form.formState.errors.storyPoints && <p className="mt-1 text-xs text-red-500">{form.formState.errors.storyPoints.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">زمان تخمینی (ساعت)</label>
              <input {...form.register('estimatedHours', { setValueAs: value => value === '' ? undefined : Number(value) })} disabled={!canCreateTask} aria-invalid={!!form.formState.errors.estimatedHours} type="number" min="1" placeholder="۴" className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm disabled:cursor-not-allowed disabled:opacity-60" dir="ltr" />
              {form.formState.errors.estimatedHours && <p className="mt-1 text-xs text-red-500">{form.formState.errors.estimatedHours.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">تاریخ تحویل</label>
            <Controller control={form.control} name="dueDate" render={({ field }) => <div className="space-y-2"><JalaliDatePicker value={field.value || null} onChange={field.onChange} disabled={!canCreateTask} placeholder="انتخاب تاریخ تحویل" />{field.value && <button type="button" disabled={!canCreateTask} onClick={() => field.onChange('')} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:cursor-not-allowed disabled:opacity-60">پاک کردن تاریخ تحویل</button>}</div>} />
            {form.formState.errors.dueDate && <p className="mt-1 text-xs text-red-500">{form.formState.errors.dueDate.message}</p>}
          </div>
          {form.formState.errors.root && <p className="text-xs text-red-500">{form.formState.errors.root.message}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => onOpenChange(false)} className="flex-1 py-2.5 rounded-xl border border-border text-foreground hover:bg-secondary transition-all text-sm">انصراف</button>
            <button type="submit" disabled={!canSubmitTask} title={canCreateTask ? undefined : loading ? displayCopy.loading : error ?? displayCopy.createUnavailable} className="app-action flex-1 disabled:cursor-not-allowed disabled:opacity-50">ایجاد وظیفه</button>
          </div>
          {!canCreateTask && <p className="text-xs text-muted-foreground">{loading ? displayCopy.loading : error ?? displayCopy.createUnavailable}</p>}
        </form>
      </div>
    </div>
  )
}
