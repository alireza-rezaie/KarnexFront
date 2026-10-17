import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useProjects } from '@/contexts/ProjectsContext'
import type { ProjectSelectionIntent } from '@/lib/project-creation-navigation'

const contentByIntent: Record<ProjectSelectionIntent, { title: string; description: string }> = {
  viewProjectOverview: {
    title: 'پروژه را انتخاب کنید',
    description: 'ابتدا پروژه‌ای را که می‌خواهید نمای کلی آن را ببینید انتخاب کنید.',
  },
  viewTasks: {
    title: 'پروژهٔ وظایف را انتخاب کنید',
    description: 'ابتدا پروژه‌ای را که می‌خواهید وظایف آن را ببینید انتخاب کنید.',
  },
  viewBacklog: {
    title: 'پروژهٔ بک‌لاگ را انتخاب کنید',
    description: 'ابتدا پروژه‌ای را که می‌خواهید بک‌لاگ آن را ببینید انتخاب کنید.',
  },
  viewBoard: {
    title: 'پروژهٔ برد را انتخاب کنید',
    description: 'ابتدا پروژه‌ای را که می‌خواهید برد آن را ببینید انتخاب کنید.',
  },
  viewTimeline: {
    title: 'پروژهٔ تایم‌لاین را انتخاب کنید',
    description: 'ابتدا پروژه‌ای را که می‌خواهید تایم‌لاین آن را ببینید انتخاب کنید.',
  },
  viewReports: {
    title: 'پروژهٔ گزارش را انتخاب کنید',
    description: 'ابتدا پروژه‌ای را که می‌خواهید گزارش آن را ببینید انتخاب کنید.',
  },
  viewProjectSettings: {
    title: 'پروژهٔ تنظیمات را انتخاب کنید',
    description: 'ابتدا پروژه‌ای را که می‌خواهید تنظیمات آن را ببینید انتخاب کنید.',
  },
  viewApprovals: {
    title: 'پروژهٔ تأییدها را انتخاب کنید',
    description: 'ابتدا پروژه‌ای را که می‌خواهید تأییدهای آن را ببینید انتخاب کنید.',
  },
  createTask: {
    title: 'پروژهٔ وظیفه جدید را انتخاب کنید',
    description: 'ابتدا پروژه‌ای را که می‌خواهید در آن ایجاد کنید انتخاب کنید.',
  },
  createSprint: {
    title: 'پروژهٔ اسپرینت جدید را انتخاب کنید',
    description: 'ابتدا پروژه‌ای را که می‌خواهید در آن ایجاد کنید انتخاب کنید.',
  },
}

interface ProjectSelectionDialogProps<TIntent extends ProjectSelectionIntent> {
  intent: TIntent | null
  onClose: () => void
  onSelect: (projectId: string, intent: TIntent) => void
}

export default function ProjectSelectionDialog<TIntent extends ProjectSelectionIntent>({ intent, onClose, onSelect }: ProjectSelectionDialogProps<TIntent>) {
  const { projects } = useProjects()
  const content = intent ? contentByIntent[intent] : null

  return (
    <Dialog open={intent !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{content?.title}</DialogTitle>
          <DialogDescription>{content?.description}</DialogDescription>
        </DialogHeader>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => intent && onSelect(project.id, intent)}
              className="flex w-full flex-col rounded-lg px-3 py-2 text-right transition-colors hover:bg-secondary"
            >
              <span className="text-sm font-medium">{project.name}</span>
              <span className="text-xs text-muted-foreground">{project.key}</span>
            </button>
          ))}
          {projects.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">پروژه‌ای برای انتخاب وجود ندارد.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
