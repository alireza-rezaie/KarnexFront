import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react'
import { useProjectBoard } from '@/contexts/ProjectBoardContext'
import { useSprints } from '@/contexts/SprintsContext'
import { useWorkflowCatalog } from '@/contexts/WorkflowCatalogContext'
import { getTerminalStatusIds as resolveTerminalStatusIds } from '@/utils/terminalStatusPolicy'

type CompletionCandidate = { projectId: string; status: string }

type TerminalStatusPolicyValue = {
  getTerminalStatusIds: (projectId: string) => string[]
  isTaskCompleted: (projectId: string, task: CompletionCandidate) => boolean
}

const TerminalStatusPolicyContext = createContext<TerminalStatusPolicyValue | undefined>(undefined)

/** Bridges the Board/workflow authorities to Sprint completion without duplicating completion semantics. */
export function TerminalStatusPolicyProvider({ children }: { children: ReactNode }) {
  const { getBoardConfiguration } = useProjectBoard()
  const { getActiveWorkflow } = useWorkflowCatalog()
  const { registerTerminalStatusResolver } = useSprints()

  const getTerminalStatusIds = useCallback((projectId: string) => {
      const activeWorkflow = getActiveWorkflow(projectId)
      const configuration = activeWorkflow
        ? getBoardConfiguration(projectId, activeWorkflow.statuses)
        : undefined
      return resolveTerminalStatusIds(projectId, configuration, activeWorkflow)
  }, [getActiveWorkflow, getBoardConfiguration])

  const isTaskCompleted = useCallback((projectId: string, task: CompletionCandidate) => (
    task.projectId === projectId && getTerminalStatusIds(projectId).includes(task.status)
  ), [getTerminalStatusIds])

  useEffect(() => {
    registerTerminalStatusResolver(getTerminalStatusIds)
    return () => registerTerminalStatusResolver(null)
  }, [getTerminalStatusIds, registerTerminalStatusResolver])

  const value = useMemo(() => ({ getTerminalStatusIds, isTaskCompleted }), [getTerminalStatusIds, isTaskCompleted])

  return <TerminalStatusPolicyContext.Provider value={value}>{children}</TerminalStatusPolicyContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTerminalStatusPolicy() {
  const policy = useContext(TerminalStatusPolicyContext)
  if (!policy) throw new Error('useTerminalStatusPolicy must be used within TerminalStatusPolicyProvider')
  return policy
}

// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalTerminalStatusPolicy() {
  return useContext(TerminalStatusPolicyContext)
}
