import { useEffect, useRef } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { ApprovalRequestsProvider, useApprovalRequests } from '@/contexts/ApprovalRequestsContext'
import { CurrentUserProvider, useCurrentUser } from '@/contexts/CurrentUserContext'
import { MembersProvider, useMembers } from '@/contexts/MembersContext'
import { ProjectProvider } from '@/contexts/ProjectContext'
import { ProjectStatusProvider } from '@/contexts/ProjectStatusContext'
import { ProjectTaskProvider, useProjectTasks } from '@/contexts/ProjectTaskContext'
import { ProjectWorkflowProvider, useProjectWorkflow } from '@/contexts/ProjectWorkflowContext'
import { ProjectsProvider } from '@/contexts/ProjectsContext'
import { RolesProvider } from '@/contexts/RolesContext'
import { TasksProvider } from '@/contexts/TasksContext'
import { AuthenticatedTestProvider } from '@/test/AuthTestProvider'
import ApprovalsPage from '@/pages/ApprovalsPage'
import { projects } from '@/test/fixtures/mockData'

const projectId = projects[0]!.id

function RequestSeed() {
  const seeded = useRef(false)
  const { createRequest } = useApprovalRequests()
  const { tasks } = useProjectTasks()
  const { transitions } = useProjectWorkflow()
  const { currentMember } = useCurrentUser()
  const { members } = useMembers()
  useEffect(() => {
    if (seeded.current || !currentMember) return
    const requester = members.find((member) => member.id !== currentMember.id)
    const task = tasks.find((item) => item.status === 'todo')
    const transition = transitions.find((item) => item.from === task?.status)
    if (!requester || !task || !transition) return
    seeded.current = true
    createRequest({
      projectId,
      task,
      requesterId: requester.id,
      transition: { ...transition, approval: { mode: 'required', approverType: 'member', approverIds: [currentMember.id], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: true } },
    })
  }, [createRequest, currentMember, members, tasks, transitions])
  return null
}

function Wrapper() {
  return <AuthenticatedTestProvider userId="m1"><MembersProvider><RolesProvider><ProjectsProvider><TasksProvider><ApprovalRequestsProvider><MemoryRouter initialEntries={[`/projects/${projectId}/approvals`]}><Routes><Route path="/projects/:projectId/*" element={<CurrentUserProvider><ProjectProvider><ProjectTaskProvider><ProjectWorkflowProvider><ProjectStatusProvider><RequestSeed /><ApprovalsPage /></ProjectStatusProvider></ProjectWorkflowProvider></ProjectTaskProvider></ProjectProvider></CurrentUserProvider>} /></Routes></MemoryRouter></ApprovalRequestsProvider></TasksProvider></ProjectsProvider></RolesProvider></MembersProvider></AuthenticatedTestProvider>
}

afterEach(cleanup)
describe('project approval center', () => {
  it('renders a project-scoped action request with live progress and status', async () => {
    render(<Wrapper />)
    expect(await screen.findByText('درخواست‌های تأیید')).toBeTruthy()
    expect(await screen.findByText('0 از 1 تأیید دریافت شده')).toBeTruthy()
    expect(screen.getByText('در انتظار تأیید')).toBeTruthy()
  })
  it('approves through the shared runtime engine and updates the visible request', async () => {
    render(<Wrapper />)
    const approve = await screen.findByRole('button', { name: 'تأیید' })
    fireEvent.click(approve)
    fireEvent.click(screen.getByRole('button', { name: 'همه درخواست‌ها' }))
    await waitFor(() => expect(screen.getAllByText('تأیید شده').length).toBeGreaterThan(1))
    expect(screen.queryByRole('button', { name: 'تأیید' })).toBeNull()
  })
  it('enforces the real rejection-reason requirement in the shared action dialog', async () => {
    render(<Wrapper />)
    fireEvent.click(await screen.findByRole('button', { name: 'رد' }))
    fireEvent.click(screen.getByRole('button', { name: 'رد درخواست' }))
    expect(await screen.findByText('وارد کردن دلیل رد الزامی است.')).toBeTruthy()
    expect(screen.getByRole('dialog', { name: 'رد درخواست انتقال' })).toBeTruthy()
  })
  it('keeps all-status filtering derived and exposes the documented empty my-requests state', async () => {
    render(<Wrapper />)
    fireEvent.click(await screen.findByRole('button', { name: 'درخواست‌های من' }))
    expect(await screen.findByText('هنوز درخواست تأییدی ثبت نکرده‌اید.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'همه درخواست‌ها' }))
    fireEvent.click(screen.getByRole('button', { name: 'در انتظار' }))
    expect(await screen.findByText('در انتظار تأیید')).toBeTruthy()
  })

  it('distinguishes an empty status-filter result from a project with no approval requests', async () => {
    render(<Wrapper />)
    fireEvent.click(await screen.findByRole('button', { name: 'همه درخواست‌ها' }))
    fireEvent.click(screen.getByRole('button', { name: 'تأیید شده' }))

    expect(await screen.findByText('درخواستی با فیلتر وضعیت انتخاب‌شده پیدا نشد.')).toBeTruthy()
  })
})
