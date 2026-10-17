import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Member } from '@/types/member'
import type { Role } from '@/types/role'
import type { Sprint } from '@/types/sprint'
import type { WorkflowTransition } from '@/types/workflow'
import type {
  ApprovalPolicy,
  TransitionValidator,
  TransitionValidatorField,
  WorkflowConditionField,
  WorkflowConditionGroup,
  WorkflowConditionNode,
  WorkflowConditionRule,
  WorkflowRuleOperator,
  WorkflowRuleValue,
} from '@/types/workflowPolicy'
import { isWorkflowRuleOperatorCompatible, validateApprovalPolicy } from '@/utils/workflowPolicy'

type Props = {
  transition: WorkflowTransition
  members: Member[]
  roles: Role[]
  sprints: Sprint[]
  onChange: (transition: WorkflowTransition) => void
}

const fields: Array<{ id: WorkflowConditionField; label: string }> = [
  { id: 'task.type', label: 'نوع وظیفه' }, { id: 'task.priority', label: 'اولویت' },
  { id: 'task.assignee', label: 'مسئول' }, { id: 'task.reporter', label: 'گزارش‌دهنده' },
  { id: 'task.sprintId', label: 'اسپرینت' }, { id: 'task.storyPoints', label: 'Story Point' },
  { id: 'task.estimatedSeconds', label: 'زمان تخمینی' }, { id: 'task.labels', label: 'برچسب' },
  { id: 'task.acceptanceCriteria', label: 'همهٔ معیارهای پذیرش تکمیل شده‌اند' },
  { id: 'actor.id', label: 'کاربر فعلی' }, { id: 'actor.roleIds', label: 'نقش کاربر' },
]
const operatorLabels: Record<WorkflowRuleOperator, string> = {
  equals: '=', notEquals: '≠', isEmpty: 'خالی است', isNotEmpty: 'خالی نیست',
  greaterThan: 'بزرگ‌تر از', greaterThanOrEqual: 'بزرگ‌تر یا مساوی', lessThan: 'کوچک‌تر از', lessThanOrEqual: 'کوچک‌تر یا مساوی',
  contains: 'شامل', notContains: 'شامل نیست',
}
const allOperators = Object.keys(operatorLabels) as WorkflowRuleOperator[]
const valueRequired = (operator: WorkflowRuleOperator) => operator !== 'isEmpty' && operator !== 'isNotEmpty'
const hasValue = (value: WorkflowRuleValue | undefined) => Boolean(value && (value.source === 'CURRENT_USER_ID' || (value.source === 'LITERAL' && value.value !== '')))
const literal = (value: string | number | boolean): WorkflowRuleValue => ({ source: 'LITERAL', value })
const uid = (prefix: string) => `${prefix}-${crypto.randomUUID()}`
const newRule = (): WorkflowConditionRule => ({ id: uid('condition'), kind: 'rule', field: 'task.type', operator: 'equals' })
const newGroup = (): WorkflowConditionGroup => ({ id: uid('condition-group'), kind: 'group', operator: 'AND', children: [] })
const newValidator = (): TransitionValidator => ({ id: uid('validator'), field: 'task.assignee', operator: 'isNotEmpty' })

function updateNode(group: WorkflowConditionGroup, id: string, update: (node: WorkflowConditionNode) => WorkflowConditionNode): WorkflowConditionGroup {
  return {
    ...group,
    children: group.children.map((child) => child.id === id ? update(child) : child.kind === 'group' ? updateNode(child, id, update) : child),
  }
}
function removeNode(group: WorkflowConditionGroup, id: string): WorkflowConditionGroup {
  return { ...group, children: group.children.filter((child) => child.id !== id).map((child) => child.kind === 'group' ? removeNode(child, id) : child) }
}
function addChild(group: WorkflowConditionGroup, parentId: string, child: WorkflowConditionNode): WorkflowConditionGroup {
  if (group.id === parentId) return { ...group, children: [...group.children, child] }
  return { ...group, children: group.children.map((node) => node.kind === 'group' ? addChild(node, parentId, child) : node) }
}

function operatorOptions(field: WorkflowConditionField) {
  return allOperators.filter((operator) => isWorkflowRuleOperatorCompatible(field, operator))
}
function firstOperator(field: WorkflowConditionField) {
  return operatorOptions(field)[0] ?? 'isNotEmpty'
}

export function WorkflowRuleBuilder({ transition, members, roles, sprints, onChange }: Props) {
  const root = transition.conditions ?? { id: `conditions-${transition.id}`, kind: 'group' as const, operator: 'AND' as const, children: [] }
  const validators = transition.validators ?? []
  const approval = transition.approval ?? { mode: 'none' as const }
  const commitConditions = (conditions: WorkflowConditionGroup) => onChange({ ...transition, conditions })
  const commitValidators = (nextValidators: TransitionValidator[]) => onChange({ ...transition, validators: nextValidators })
  const commitApproval = (nextApproval: ApprovalPolicy) => onChange({ ...transition, approval: nextApproval })
  const approvalErrors = validateApprovalPolicy(approval, { memberIds: members.map((member) => member.id), roleIds: roles.map((role) => role.id) }).errors

  return <div className="mt-4 grid gap-4 text-xs" dir="rtl">
    <section className="rounded-xl border border-border/60 bg-surface-inset/35 p-3">
      <header className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold text-foreground">شرایط مجاز بودن انتقال</h3><p className="mt-1 text-[10px] text-muted-foreground">پیش از امکان شروع انتقال بررسی می‌شوند.</p></div><div className="flex gap-1"><Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => commitConditions(addChild(root, root.id, newRule()))}><Plus className="size-3" />افزودن شرط</Button><Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => commitConditions(addChild(root, root.id, newGroup()))}><Plus className="size-3" />افزودن گروه</Button></div></header>
      {root.children.length ? <div className="mt-3 grid gap-2"><ConditionGroupEditor group={root} depth={0} members={members} roles={roles} sprints={sprints} isRoot onUpdate={commitConditions} onRemove={() => undefined} /></div> : <p className="mt-3 rounded-lg border border-dashed border-border/70 p-3 text-[11px] text-muted-foreground">برای این انتقال هنوز شرط یا اعتبارسنجی تعریف نشده است.</p>}
    </section>
    <section className="rounded-xl border border-border/60 bg-surface-inset/35 p-3">
      <header className="flex items-center justify-between gap-2"><div><h3 className="font-semibold text-foreground">اعتبارسنجی هنگام انتقال</h3><p className="mt-1 text-[10px] text-muted-foreground">همهٔ اعتبارسنجی‌ها باید برقرار باشند.</p></div><Button type="button" size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => commitValidators([...validators, newValidator()])}><Plus className="size-3" />افزودن اعتبارسنج</Button></header>
      {validators.length ? <div className="mt-3 grid gap-2">{validators.map((validator) => <ValidatorEditor key={validator.id} validator={validator} members={members} sprints={sprints} onChange={(next) => commitValidators(validators.map((item) => item.id === next.id ? next : item))} onRemove={() => commitValidators(validators.filter((item) => item.id !== validator.id))} />)}</div> : <p className="mt-3 rounded-lg border border-dashed border-border/70 p-3 text-[11px] text-muted-foreground">برای این انتقال هنوز اعتبارسنجی تعریف نشده است.</p>}
    </section>
    <section className="rounded-xl border border-border/60 bg-surface-inset/35 p-3">
      <h3 className="font-semibold text-foreground">تأیید انتقال</h3><div className="mt-3 flex gap-4"><label className="flex items-center gap-1.5"><input type="radio" checked={approval.mode === 'none'} onChange={() => commitApproval({ mode: 'none' })} />بدون تأیید</label><label className="flex items-center gap-1.5"><input type="radio" checked={approval.mode === 'required'} onChange={() => commitApproval({ mode: 'required', approverType: 'role', approverIds: [], minApprovals: 1, requesterCanApprove: false, rejectionRequiresReason: true })} />نیازمند تأیید</label></div>
      {approval.mode === 'required' && <ApprovalEditor policy={approval} members={members} roles={roles} errors={approvalErrors.map((error) => error.message)} onChange={commitApproval} />}
    </section>
  </div>
}

function ConditionGroupEditor({ group, depth, members, roles, sprints, isRoot, onUpdate, onRemove }: { group: WorkflowConditionGroup; depth: number; members: Member[]; roles: Role[]; sprints: Sprint[]; isRoot: boolean; onUpdate: (group: WorkflowConditionGroup) => void; onRemove: () => void }) {
  const setChild = (node: WorkflowConditionNode) => onUpdate(updateNode(group, node.id, () => node))
  return <div className={depth ? 'rounded-lg border border-primary/20 bg-card/45 p-2' : 'grid gap-2'} style={{ marginInlineStart: depth ? 12 : 0 }}>
    <div className="flex items-center gap-2"><select aria-label="عملگر گروه" value={group.operator} onChange={(event) => onUpdate({ ...group, operator: event.target.value as 'AND' | 'OR' })} className="h-7 rounded-md border border-border bg-background px-2 text-[10px]"><option value="AND">AND — همه</option><option value="OR">OR — یکی</option></select><Button type="button" size="sm" variant="ghost" className="h-7 px-1.5 text-[10px]" onClick={() => onUpdate(addChild(group, group.id, newRule()))}><Plus className="size-3" />شرط</Button><Button type="button" size="sm" variant="ghost" className="h-7 px-1.5 text-[10px]" onClick={() => onUpdate(addChild(group, group.id, newGroup()))}><Plus className="size-3" />گروه</Button>{!isRoot && <Button type="button" size="icon-sm" variant="ghost" className="text-destructive" onClick={onRemove} aria-label="حذف گروه"><Trash2 /></Button>}</div>
    <div className="mt-2 grid gap-2">{group.children.map((node) => node.kind === 'group' ? <ConditionGroupEditor key={node.id} group={node} depth={depth + 1} members={members} roles={roles} sprints={sprints} isRoot={false} onUpdate={(next) => onUpdate(updateNode(group, node.id, () => next))} onRemove={() => onUpdate(removeNode(group, node.id))} /> : <RuleEditor key={node.id} rule={node} members={members} roles={roles} sprints={sprints} onChange={setChild} onRemove={() => onUpdate(removeNode(group, node.id))} />)}</div>
  </div>
}

function RuleEditor({ rule, members, roles, sprints, onChange, onRemove }: { rule: WorkflowConditionRule; members: Member[]; roles: Role[]; sprints: Sprint[]; onChange: (rule: WorkflowConditionRule) => void; onRemove: () => void }) {
  return <div className="rounded-lg border border-border/65 bg-card/65 p-2"><div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"><FieldSelect value={rule.field} onChange={(field) => onChange({ ...rule, field, operator: firstOperator(field), value: undefined })} /><OperatorSelect field={rule.field} value={rule.operator} onChange={(operator) => onChange({ ...rule, operator, value: valueRequired(operator) ? rule.value : undefined })} />{valueRequired(rule.operator) ? <ValueEditor field={rule.field} value={rule.value} members={members} roles={roles} sprints={sprints} onChange={(value) => onChange({ ...rule, value })} /> : <span className="rounded-md border border-dashed border-border/60 px-2 py-1.5 text-[10px] text-muted-foreground">بدون مقدار</span>}<Button type="button" size="icon-sm" variant="ghost" className="text-destructive" onClick={onRemove} aria-label="حذف شرط"><Trash2 /></Button></div>{valueRequired(rule.operator) && !hasValue(rule.value) && <p className="mt-1 text-[10px] text-destructive">برای این شرط مقدار لازم است.</p>}</div>
}

function ValidatorEditor({ validator, members, sprints, onChange, onRemove }: { validator: TransitionValidator; members: Member[]; sprints: Sprint[]; onChange: (validator: TransitionValidator) => void; onRemove: () => void }) {
  return <div className="rounded-lg border border-border/65 bg-card/65 p-2"><div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"><FieldSelect value={validator.field} validator onChange={(field) => onChange({ ...validator, field: field as TransitionValidatorField, operator: firstOperator(field), value: undefined })} /><OperatorSelect field={validator.field} value={validator.operator} onChange={(operator) => onChange({ ...validator, operator, value: valueRequired(operator) ? validator.value : undefined })} />{valueRequired(validator.operator) ? <ValueEditor field={validator.field} value={validator.value} members={members} roles={[]} sprints={sprints} onChange={(value) => onChange({ ...validator, value })} /> : <span className="rounded-md border border-dashed border-border/60 px-2 py-1.5 text-[10px] text-muted-foreground">بدون مقدار</span>}<Button type="button" size="icon-sm" variant="ghost" className="text-destructive" onClick={onRemove} aria-label="حذف اعتبارسنج"><Trash2 /></Button></div><Input className="mt-2 h-7 text-[10px]" defaultValue={validator.message ?? ''} placeholder="پیام خطا (اختیاری)" onBlur={(event) => onChange({ ...validator, message: event.target.value.trim() || undefined })} />{valueRequired(validator.operator) && !hasValue(validator.value) && <p className="mt-1 text-[10px] text-destructive">برای این اعتبارسنج مقدار لازم است.</p>}</div>
}

function FieldSelect({ value, onChange, validator = false }: { value: WorkflowConditionField; onChange: (field: WorkflowConditionField) => void; validator?: boolean }) {
  return <select aria-label="فیلد قانون" value={value} onChange={(event) => onChange(event.target.value as WorkflowConditionField)} className="h-8 rounded-md border border-border bg-background px-2 text-[11px]">{fields.filter((field) => !validator || !field.id.startsWith('actor.')).map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}</select>
}
function OperatorSelect({ field, value, onChange }: { field: WorkflowConditionField; value: WorkflowRuleOperator; onChange: (operator: WorkflowRuleOperator) => void }) {
  return <select aria-label="عملگر قانون" value={value} onChange={(event) => onChange(event.target.value as WorkflowRuleOperator)} className="h-8 rounded-md border border-border bg-background px-2 text-[11px]">{operatorOptions(field).map((operator) => <option key={operator} value={operator}>{operatorLabels[operator]}</option>)}</select>
}
function ValueEditor({ field, value, members, roles, sprints, onChange }: { field: WorkflowConditionField; value?: WorkflowRuleValue; members: Member[]; roles: Role[]; sprints: Sprint[]; onChange: (value: WorkflowRuleValue) => void }) {
  const current = value?.source === 'LITERAL' ? value.value : ''
  if (field === 'task.type') return <select aria-label="مقدار شرط" value={typeof current === 'string' ? current : ''} onChange={(event) => onChange(literal(event.target.value))} className="h-8 rounded-md border border-border bg-background px-2 text-[11px]"><option value="">انتخاب نوع</option>{['epic', 'story', 'task', 'bug', 'subtask'].map((item) => <option key={item} value={item}>{item}</option>)}</select>
  if (field === 'task.priority') return <select aria-label="مقدار شرط" value={typeof current === 'string' ? current : ''} onChange={(event) => onChange(literal(event.target.value))} className="h-8 rounded-md border border-border bg-background px-2 text-[11px]"><option value="">انتخاب اولویت</option>{['highest', 'high', 'medium', 'low', 'lowest'].map((item) => <option key={item} value={item}>{item}</option>)}</select>
  if (field === 'task.assignee' || field === 'task.reporter' || field === 'actor.id') return <select aria-label="مقدار شرط" value={value?.source === 'CURRENT_USER_ID' ? 'CURRENT_USER_ID' : typeof current === 'string' ? current : ''} onChange={(event) => onChange(event.target.value === 'CURRENT_USER_ID' ? { source: 'CURRENT_USER_ID' } : literal(event.target.value))} className="h-8 rounded-md border border-border bg-background px-2 text-[11px]"><option value="">انتخاب شخص</option><option value="CURRENT_USER_ID">کاربر فعلی</option>{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select>
  if (field === 'task.sprintId') return <select aria-label="مقدار شرط" value={typeof current === 'string' ? current : ''} onChange={(event) => onChange(literal(event.target.value))} className="h-8 rounded-md border border-border bg-background px-2 text-[11px]"><option value="">انتخاب اسپرینت</option>{sprints.map((sprint) => <option key={sprint.id} value={sprint.id}>{sprint.name}</option>)}</select>
  if (field === 'task.acceptanceCriteria') return <select aria-label="مقدار شرط" value={typeof current === 'boolean' ? String(current) : ''} onChange={(event) => onChange(literal(event.target.value === 'true'))} className="h-8 rounded-md border border-border bg-background px-2 text-[11px]"><option value="">انتخاب وضعیت</option><option value="true">همه تکمیل شده‌اند</option><option value="false">همه تکمیل نشده‌اند</option></select>
  if (field === 'actor.roleIds') return <select aria-label="مقدار شرط" value={typeof current === 'string' ? current : ''} onChange={(event) => onChange(literal(event.target.value))} className="h-8 rounded-md border border-border bg-background px-2 text-[11px]"><option value="">انتخاب نقش</option>{roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select>
  const numeric = field === 'task.storyPoints' || field === 'task.estimatedSeconds'
  return <Input key={JSON.stringify(value)} aria-label="مقدار شرط" type={numeric ? 'number' : 'text'} className="h-8 text-[11px]" defaultValue={typeof current === 'string' || typeof current === 'number' ? current : ''} onBlur={(event) => onChange(literal(numeric && event.target.value !== '' ? Number(event.target.value) : event.target.value))} placeholder={numeric ? 'عدد' : 'مقدار'} />
}

function ApprovalEditor({ policy, members, roles, errors, onChange }: { policy: Extract<ApprovalPolicy, { mode: 'required' }>; members: Member[]; roles: Role[]; errors: string[]; onChange: (policy: ApprovalPolicy) => void }) {
  const options = policy.approverType === 'role' ? roles : members
  return <div className="mt-3 grid gap-2"><div className="grid gap-2 sm:grid-cols-2"><select aria-label="نوع تأییدکننده" value={policy.approverType} onChange={(event) => onChange({ ...policy, approverType: event.target.value as 'role' | 'member', approverIds: [] })} className="h-8 rounded-md border border-border bg-background px-2 text-[11px]"><option value="role">نقش</option><option value="member">شخص</option></select><select aria-label="تأییدکنندگان" multiple value={policy.approverIds} onChange={(event) => onChange({ ...policy, approverIds: Array.from(event.currentTarget.selectedOptions, (option) => option.value) })} className="min-h-20 rounded-md border border-border bg-background p-2 text-[11px]">{options.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div><label className="grid gap-1 text-[10px] text-muted-foreground">حداقل تعداد تأیید<Input key={policy.minApprovals} type="number" min="1" className="h-8 text-[11px]" defaultValue={policy.minApprovals} onBlur={(event) => onChange({ ...policy, minApprovals: Number(event.target.value) })} /></label><label className="flex items-center gap-2"><input type="checkbox" checked={policy.requesterCanApprove} onChange={(event) => onChange({ ...policy, requesterCanApprove: event.target.checked })} />درخواست‌کننده می‌تواند تأیید کند</label><label className="flex items-center gap-2"><input type="checkbox" checked={policy.rejectionRequiresReason} onChange={(event) => onChange({ ...policy, rejectionRequiresReason: event.target.checked })} />رد کردن نیازمند دلیل است</label>{errors.map((error) => <p key={error} className="text-[10px] text-destructive">{error}</p>)}</div>
}
