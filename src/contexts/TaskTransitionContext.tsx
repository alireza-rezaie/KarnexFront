import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useApprovalRequests } from '@/contexts/ApprovalRequestsContext'
import { useMembers } from '@/contexts/MembersContext'
import { useProjectTasks } from '@/contexts/ProjectTaskContext'
import { useProject } from '@/contexts/ProjectContext'
import { useProjects } from '@/contexts/ProjectsContext'
import { useRoles } from '@/contexts/RolesContext'
import { useTasks } from '@/contexts/TasksContext'
import { useOptionalWorkflowCatalog } from '@/contexts/WorkflowCatalogContext'
import type { GetTaskTransitionsInput, TaskTransitionExecutionInput, TaskTransitionExecutionResult, TaskTransitionResolutionResult } from '@/types/taskTransition'
import type { Task } from '@/types/task'
import { getProjectMemberRole } from '@/types/project'
import { evaluateTaskTransitionAttempt } from '@/utils/taskTransitionPolicy'

type TaskTransitionContextValue = {
  getTaskTransitions: (input: GetTaskTransitionsInput) => TaskTransitionResolutionResult
  transitionTask: (input: TaskTransitionExecutionInput) => Promise<TaskTransitionExecutionResult>
}

const TaskTransitionContext = createContext<TaskTransitionContextValue | undefined>(undefined)
type TaskScopeResult = Extract<TaskTransitionResolutionResult, { ok: false }> | { ok: true; task: Task }

export function TaskTransitionProvider({ children }: { children: ReactNode }) {
  const { projectId: routeProjectId } = useProject()
  const { currentUserId } = useAuth()
  const { members } = useMembers()
  const { projects } = useProjects()
  const { roles } = useRoles()
  const { isTransitionApproved } = useApprovalRequests()
  const { tasks: allTasks } = useTasks()
  const { projectId, tasks: projectTasks, applyTaskTransition } = useProjectTasks()
  const workflowCatalog = useOptionalWorkflowCatalog()

  const resolveScope = useCallback((input: GetTaskTransitionsInput): TaskScopeResult => {
    if (!projectId || input.projectId !== projectId || input.projectId !== routeProjectId) {
      return { ok: false, code: 'project-mismatch', message: 'پروژهٔ انتقال با پروژهٔ جاری یکسان نیست.' }
    }
    const knownTask = allTasks.find((task) => task.id === input.taskId)
    if (!knownTask) return { ok: false, code: 'task-not-found', message: 'وظیفه پیدا نشد.' }
    if (knownTask.projectId !== projectId || !projectTasks.some((task) => task.id === input.taskId)) {
      return { ok: false, code: 'project-mismatch', message: 'وظیفه به پروژهٔ جاری تعلق ندارد.' }
    }
    return { ok: true, task: knownTask }
  }, [allTasks, projectId, projectTasks, routeProjectId])

  const getTaskTransitions = useCallback((input: GetTaskTransitionsInput): TaskTransitionResolutionResult => {
    const scope = resolveScope(input)
    if (!scope.ok) return scope
    const activeWorkflow = workflowCatalog?.getActiveWorkflow(input.projectId)
    if (!activeWorkflow) return { ok: false, code: 'active-workflow-not-found', message: 'گردش‌کار منتشرشدهٔ پروژه پیدا نشد.' }
    return { ok: true, transitions: activeWorkflow.transitions.filter((transition) => transition.from === scope.task.status) }
  }, [resolveScope, workflowCatalog])

  const transitionTask = useCallback(async (input: TaskTransitionExecutionInput): Promise<TaskTransitionExecutionResult> => {
    const scope = resolveScope(input)
    if (!scope.ok) return scope
    const activeWorkflow = workflowCatalog?.getActiveWorkflow(input.projectId)
    if (!activeWorkflow) return { ok: false, code: 'active-workflow-not-found', message: 'گردش‌کار منتشرشدهٔ پروژه پیدا نشد.' }
    const transition = activeWorkflow.transitions.find((candidate) => candidate.id === input.transitionId)
    if (!transition) return { ok: false, code: 'transition-not-found', message: 'انتقال موردنظر در گردش‌کار فعال وجود ندارد.' }
    if (transition.from !== scope.task.status) return { ok: false, code: 'source-mismatch', transition, message: 'وضعیت فعلی وظیفه با مبدأ انتقال یکسان نیست.' }
    if (!activeWorkflow.statuses.some((status) => status.id === transition.to)) {
      return { ok: false, code: 'destination-status-not-found', transition, message: 'وضعیت مقصد در گردش‌کار فعال وجود ندارد.' }
    }

    const currentMember = currentUserId ? members.find((member) => member.id === currentUserId) ?? null : null
    const project = projects.find((item) => item.id === input.projectId)
    const actorRoleId = currentMember && project
      ? getProjectMemberRole(project, currentMember.id, currentMember.roleId)
      : undefined
    const actorRoleIds = actorRoleId && roles.some((role) => role.id === actorRoleId) ? [actorRoleId] : []
    const attempt = evaluateTaskTransitionAttempt({
      task: scope.task,
      targetStatusId: transition.to,
      transitions: [transition],
      currentMember,
      actorRoleIds,
    })
    if (!attempt.allowed) {
      const approvalSatisfied = attempt.reason === 'approval-required' && isTransitionApproved({
        projectId: input.projectId,
        taskId: scope.task.id,
        currentStatusId: scope.task.status,
        transition,
      })
      if (approvalSatisfied) {
        const mutation = await applyTaskTransition(scope.task.id, transition.to)
        if (!mutation.ok) return { ok: false, code: 'mutation-failed', transition, message: mutation.message }
        return { ok: true, code: 'transitioned', transition }
      }
      return {
        ok: false,
        code: attempt.reason === 'allowed' ? 'mutation-failed' : attempt.reason,
        transition,
        validationErrors: attempt.validationErrors,
        failedConditionRuleIds: attempt.failedConditionRuleIds,
        approvalPolicy: attempt.approvalPolicy,
      }
    }

    const mutation = await applyTaskTransition(scope.task.id, transition.to)
    if (!mutation.ok) return { ok: false, code: 'mutation-failed', transition, message: mutation.message }
    return { ok: true, code: 'transitioned', transition }
  }, [applyTaskTransition, currentUserId, isTransitionApproved, members, projects, resolveScope, roles, workflowCatalog])

  const value = useMemo(() => ({ getTaskTransitions, transitionTask }), [getTaskTransitions, transitionTask])
  return <TaskTransitionContext.Provider value={value}>{children}</TaskTransitionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTaskTransitions() {
  const context = useContext(TaskTransitionContext)
  if (!context) throw new Error('useTaskTransitions must be used within a TaskTransitionProvider.')
  return context
}
