import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { WorkflowRuleBuilder } from '@/components/workflow/WorkflowRuleBuilder'
import type { Member } from '@/types/member'
import type { Role } from '@/types/role'
import type { Sprint } from '@/types/sprint'
import type { WorkflowTransition } from '@/types/workflow'

const members: Member[] = [{ id: 'm1', name: 'امیر', email: 'amir@example.com', jobTitle: 'توسعه‌دهنده', roleId: 'r1', avatar: '', status: 'online', projects: ['p1'], lastActivity: 'اکنون' }]
const roles: Role[] = [{ id: 'r1', name: 'توسعه‌دهنده', description: '' }, { id: 'r2', name: 'بازبین', description: '' }]
const sprints: Sprint[] = [{ id: 's1', projectId: 'p1', name: 'اسپرینت اول', goal: '', startDate: '1404/1/1', endDate: '1404/1/14', duration: 14, status: 'active' }]
const base: WorkflowTransition = { id: 'tr-1', from: 'todo', to: 'done' }

function Harness({ initial = base, onUpdate }: { initial?: WorkflowTransition; onUpdate?: (transition: WorkflowTransition) => void }) {
  const [transition, setTransition] = useState(initial)
  return <WorkflowRuleBuilder transition={transition} members={members} roles={roles} sprints={sprints} onChange={(next) => { setTransition(next); onUpdate?.(next) }} />
}

describe('workflow rule builder UI', () => {
  afterEach(cleanup)
  it('adds and deletes a condition', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'افزودن شرط' }))
    expect(screen.getByLabelText('فیلد قانون')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'حذف شرط' }))
    expect(screen.queryByLabelText('فیلد قانون')).toBeNull()
  })
  it('changes available operators for a numeric condition field', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'افزودن شرط' }))
    fireEvent.change(screen.getByLabelText('فیلد قانون'), { target: { value: 'task.storyPoints' } })
    const operator = screen.getByLabelText('عملگر قانون') as HTMLSelectElement
    expect(Array.from(operator.options, (option) => option.value)).toContain('greaterThan')
    expect(Array.from(operator.options, (option) => option.value)).not.toContain('contains')
  })
  it('hides the value editor for isEmpty', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'افزودن شرط' }))
    fireEvent.change(screen.getByLabelText('عملگر قانون'), { target: { value: 'isEmpty' } })
    expect(screen.queryByLabelText('مقدار شرط')).toBeNull()
    expect(screen.getByText('بدون مقدار')).toBeTruthy()
  })
  it('resolves member options and CURRENT_USER_ID in a member value editor', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'افزودن شرط' }))
    fireEvent.change(screen.getByLabelText('فیلد قانون'), { target: { value: 'task.assignee' } })
    const value = screen.getByLabelText('مقدار شرط') as HTMLSelectElement
    expect(Array.from(value.options, (option) => option.text)).toEqual(expect.arrayContaining(['کاربر فعلی', 'امیر']))
    fireEvent.change(value, { target: { value: 'CURRENT_USER_ID' } })
    expect(value.value).toBe('CURRENT_USER_ID')
  })
  it('adds nested groups and changes AND/OR', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'افزودن گروه' }))
    const groups = screen.getAllByLabelText('عملگر گروه') as HTMLSelectElement[]
    fireEvent.change(groups[1]!, { target: { value: 'OR' } })
    expect((screen.getAllByLabelText('عملگر گروه') as HTMLSelectElement[])[1]!.value).toBe('OR')
  })
  it('adds and deletes validators and commits a custom message on blur', () => {
    let updates = 0
    render(<Harness onUpdate={() => { updates += 1 }} />)
    fireEvent.click(screen.getByRole('button', { name: 'افزودن اعتبارسنج' }))
    const message = screen.getByPlaceholderText('پیام خطا (اختیاری)')
    fireEvent.change(message, { target: { value: 'پیام سفارشی' } })
    fireEvent.blur(message)
    expect(updates).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'حذف اعتبارسنج' }))
    expect(screen.queryByRole('button', { name: 'حذف اعتبارسنج' })).toBeNull()
  })
  it('edits approval mode, role approvers, and inline invalid approval feedback', () => {
    render(<Harness />)
    fireEvent.click(screen.getByLabelText('نیازمند تأیید'))
    expect(screen.getByText('حداقل یک تأییدکننده باید مشخص شود.')).toBeTruthy()
    const approvers = screen.getByLabelText('تأییدکنندگان') as HTMLSelectElement
    approvers.options[1]!.selected = true
    fireEvent.change(approvers)
    expect(screen.queryByText('حداقل یک تأییدکننده باید مشخص شود.')).toBeNull()
  })
  it('switches approval approver selection to members', () => {
    render(<Harness />)
    fireEvent.click(screen.getByLabelText('نیازمند تأیید'))
    fireEvent.change(screen.getByLabelText('نوع تأییدکننده'), { target: { value: 'member' } })
    expect(Array.from((screen.getByLabelText('تأییدکنندگان') as HTMLSelectElement).options, (option) => option.text)).toContain('امیر')
  })
  it('marks transition draft policy changes through the real update callback', () => {
    let update: WorkflowTransition | undefined
    render(<Harness onUpdate={(next) => { update = next }} />)
    fireEvent.click(screen.getByRole('button', { name: 'افزودن شرط' }))
    expect(update?.conditions?.children).toHaveLength(1)
  })
  it('uses only current-project sprint options supplied to the builder', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'افزودن شرط' }))
    fireEvent.change(screen.getByLabelText('فیلد قانون'), { target: { value: 'task.sprintId' } })
    expect(Array.from((screen.getByLabelText('مقدار شرط') as HTMLSelectElement).options, (option) => option.text)).toContain('اسپرینت اول')
  })
  it('uses a text value editor for labels', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'افزودن شرط' }))
    fireEvent.change(screen.getByLabelText('فیلد قانون'), { target: { value: 'task.labels' } })
    fireEvent.change(screen.getByLabelText('عملگر قانون'), { target: { value: 'contains' } })
    expect((screen.getByLabelText('مقدار شرط') as HTMLInputElement).type).toBe('text')
  })
  it('offers numeric operators for a numeric validator', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'افزودن اعتبارسنج' }))
    fireEvent.change(screen.getByLabelText('فیلد قانون'), { target: { value: 'task.estimatedSeconds' } })
    expect(Array.from((screen.getByLabelText('عملگر قانون') as HTMLSelectElement).options, (option) => option.value)).toContain('lessThanOrEqual')
  })
  it('changes requester and rejection policy flags', () => {
    render(<Harness />)
    fireEvent.click(screen.getByLabelText('نیازمند تأیید'))
    const requester = screen.getByLabelText('درخواست‌کننده می‌تواند تأیید کند') as HTMLInputElement
    const rejection = screen.getByLabelText('رد کردن نیازمند دلیل است') as HTMLInputElement
    fireEvent.click(requester)
    fireEvent.click(rejection)
    expect(requester.checked).toBe(true)
    expect(rejection.checked).toBe(false)
  })
  it('removes required approval configuration when no approval is selected', () => {
    render(<Harness />)
    fireEvent.click(screen.getByLabelText('نیازمند تأیید'))
    fireEvent.click(screen.getByLabelText('بدون تأیید'))
    expect(screen.queryByLabelText('نوع تأییدکننده')).toBeNull()
  })
  it('commits numeric rule input only after blur', () => {
    let updates = 0
    render(<Harness onUpdate={() => { updates += 1 }} />)
    fireEvent.click(screen.getByRole('button', { name: 'افزودن شرط' }))
    fireEvent.change(screen.getByLabelText('فیلد قانون'), { target: { value: 'task.storyPoints' } })
    const beforeTyping = updates
    const value = screen.getByLabelText('مقدار شرط')
    fireEvent.change(value, { target: { value: '3' } })
    expect(updates).toBe(beforeTyping)
    fireEvent.blur(value)
    expect(updates).toBeGreaterThan(beforeTyping)
  })
})
