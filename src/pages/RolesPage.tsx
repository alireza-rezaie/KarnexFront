import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Shield, Plus, Edit3, Trash2, Check, X } from 'lucide-react'
import { useRoles } from '@/contexts/RolesContext'
import { useOptionalProject } from '@/contexts/ProjectContext'
import type { Role } from '@/types/role'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const roleFormSchema = z.object({
  name: z.string().trim().min(1, 'نام نقش الزامی است'),
  description: z.string().trim(),
})

type RoleFormValues = z.infer<typeof roleFormSchema>
const roleFormDefaultValues: RoleFormValues = { name: '', description: '' }

export default function RolesPage() {
  const { roles, permissions, rolePermissions, loading, error, capabilities, displayCopy, canManageRoles, createRole, updateRole, deleteRole } = useRoles()
  const projectContext = useOptionalProject()
  const projectId = projectContext?.projectId
  const [selectedRole, setSelectedRole] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [editingRoleId, setEditingRoleId] = useState<Role['id'] | null>(null)
  const [deletingRoleId, setDeletingRoleId] = useState<Role['id'] | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [permissionError, setPermissionError] = useState('')
  const createForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: roleFormDefaultValues,
  })
  const editForm = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: roleFormDefaultValues,
  })
  const editingRole = roles.find((role) => role.id === editingRoleId)
  const deletingRole = roles.find((role) => role.id === deletingRoleId)
  const isAuthorized = canManageRoles(projectId)
  const canCreateRole = Boolean(projectId && isAuthorized && !loading && capabilities.canCreateRole && createRole)
  const canUpdateRole = Boolean(projectId && isAuthorized && !loading && capabilities.canUpdateRole && updateRole)
  const canDeleteRole = Boolean(projectId && isAuthorized && !loading && capabilities.canDeleteRole && deleteRole)
  const activeSelectedRole = roles.some((role) => role.id === selectedRole) ? selectedRole : (roles[0]?.id ?? '')

  function openCreate() {
    createForm.reset(roleFormDefaultValues)
    setCreateOpen(true)
  }

  async function submitCreate(values: RoleFormValues) {
    if (!createRole) {
      createForm.setError('root', { message: error ?? displayCopy.actionUnavailable })
      return
    }
    if (!projectId) return
    const result = await createRole(projectId, values)
    if (!result.ok) {
      createForm.setError('root', { message: result.message ?? error ?? displayCopy.actionUnavailable })
      return
    }

    if (result.role) setSelectedRole(result.role.id)
    createForm.reset(roleFormDefaultValues)
    setCreateOpen(false)
  }

  function openEdit() {
    const role = roles.find((item) => item.id === activeSelectedRole)
    if (!role) return

    editForm.reset({ name: role.name, description: role.description })
    setEditingRoleId(role.id)
  }

  async function submitEdit(values: RoleFormValues) {
    if (!editingRoleId) return
    if (!updateRole) {
      editForm.setError('root', { message: error ?? displayCopy.actionUnavailable })
      return
    }
    if (!projectId) return
    const result = await updateRole(projectId, editingRoleId, values)
    if (!result.ok) {
      editForm.setError('root', { message: result.message ?? error ?? displayCopy.actionUnavailable })
      return
    }
    setEditingRoleId(null)
  }

  function openDelete() {
    if (!roles.some((role) => role.id === activeSelectedRole)) return

    setDeleteError('')
    setDeletingRoleId(activeSelectedRole)
  }

  async function confirmDelete() {
    if (!deletingRoleId) return
    if (!deleteRole) {
      setDeleteError(error ?? displayCopy.actionUnavailable)
      return
    }
    if (!projectId) return
    const result = await deleteRole(projectId, deletingRoleId)
    if (!result.ok) {
      setDeleteError(result.message ?? error ?? displayCopy.actionUnavailable)
      return
    }

    setSelectedRole(roles.find((role) => role.id !== deletingRoleId)?.id ?? '')
    setDeletingRoleId(null)
  }

  async function togglePermission(moduleIndex: number, permissionIndex: number) {
    if (!projectId || !activeSelectedRole || !updateRole || !canUpdateRole) return
    const current = rolePermissions[activeSelectedRole] ?? permissions.map((permission) => permission.perms.map(() => false))
    const next = current.map((row, rowIndex) => row.map((allowed, columnIndex) => (
      rowIndex === moduleIndex && columnIndex === permissionIndex ? !allowed : allowed
    )))
    const result = await updateRole(projectId, activeSelectedRole, { permissions: next })
    setPermissionError(result.ok ? '' : result.message ?? displayCopy.actionUnavailable)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">نقش‌ها و دسترسی‌ها</h1>
          <p className="text-sm text-muted-foreground mt-1">{projectContext?.currentProject ? `مدیریت نقش‌ها و سطح دسترسی پروژه «${projectContext.currentProject.name}»` : 'برای مدیریت نقش‌ها، یک پروژه را باز کنید.'}</p>
        </div>
        <button className="app-action" onClick={openCreate} disabled={!canCreateRole}>
          <Plus className="w-4 h-4" />
          نقش جدید
        </button>
      </div>

      {!isAuthorized && <p className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">{displayCopy.actionUnavailable}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="space-y-2">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRole(role.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-right ${
                activeSelectedRole === role.id 
                  ? 'border-primary bg-primary/5' 
                  : 'border-border bg-card hover:border-border/80'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                activeSelectedRole === role.id ? 'bg-primary/10' : 'bg-secondary'
              }`}>
                <Shield className={`w-4 h-4 ${activeSelectedRole === role.id ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-xs font-medium text-foreground">{role.name}</h3>
                <p className="text-[10px] text-muted-foreground">{role.description}</p>
              </div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-3 karnex-card p-5 overflow-x-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm text-foreground">
              دسترسی‌ها: {roles.find(r => r.id === activeSelectedRole)?.name ?? 'نقشی انتخاب نشده است'}
            </h3>
            <div className="flex gap-2">
              <button className="p-2 rounded-lg hover:bg-secondary transition-colors" onClick={openEdit} disabled={!canUpdateRole || !roles.some((role) => role.id === activeSelectedRole)}>
                <Edit3 className="w-4 h-4 text-muted-foreground" />
              </button>
              <button className="p-2 rounded-lg hover:bg-secondary transition-colors" onClick={openDelete} disabled={!canDeleteRole || !roles.some((role) => role.id === activeSelectedRole)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </button>
            </div>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">ماژول</th>
                {['مشاهده', 'ایجاد', 'ویرایش', 'حذف', 'مدیریت'].map(p => (
                  <th key={p} className="px-4 py-3 text-center text-xs font-medium text-muted-foreground">{p}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {permissions.map((perm, mi) => (
                <tr key={perm.module} className="border-b border-border">
                  <td className="px-4 py-3 text-xs font-medium text-foreground">{perm.module}</td>
                  {perm.perms.map((_, pi) => (
                    <td key={pi} className="px-4 py-3 text-center">
                      <button type="button" aria-label={`تغییر دسترسی ${perm.module} ${perm.perms[pi]}`} onClick={() => void togglePermission(mi, pi)} disabled={!canUpdateRole || !activeSelectedRole} className="rounded p-1 disabled:cursor-not-allowed disabled:opacity-60">
                        {rolePermissions[activeSelectedRole]?.[mi]?.[pi] ? <Check className="w-4 h-4 text-green-400 mx-auto" /> : <X className="w-4 h-4 text-muted-foreground/30 mx-auto" />}
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {permissionError && <p className="mt-3 text-sm text-destructive">{permissionError}</p>}
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>نقش جدید</DialogTitle><DialogDescription>نام و توضیحات نقش را وارد کنید.</DialogDescription></DialogHeader>
          <form onSubmit={createForm.handleSubmit(submitCreate)} className="space-y-4">
            <label className="block text-sm">نام نقش<input {...createForm.register('name')} disabled={!canCreateRole} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" />{createForm.formState.errors.name && <small className="mt-1 block text-destructive">{createForm.formState.errors.name.message}</small>}</label>
            <label className="block text-sm">توضیحات<textarea {...createForm.register('description')} disabled={!canCreateRole} className="mt-1 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2" />{createForm.formState.errors.description && <small className="mt-1 block text-destructive">{createForm.formState.errors.description.message}</small>}</label>
            {createForm.formState.errors.root?.message && <small className="mt-1 block text-destructive">{String(createForm.formState.errors.root.message)}</small>}<DialogFooter><button type="button" className="app-action" onClick={() => setCreateOpen(false)}>انصراف</button><button type="submit" className="app-action" disabled={!canCreateRole}>{loading ? displayCopy.loading : 'ایجاد نقش'}</button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editingRoleId !== null} onOpenChange={(open) => { if (!open) setEditingRoleId(null) }}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>ویرایش نقش</DialogTitle><DialogDescription>نام و توضیحات نقش را به‌روزرسانی کنید.</DialogDescription></DialogHeader>
          {editingRole && <form onSubmit={editForm.handleSubmit(submitEdit)} className="space-y-4">
            <label className="block text-sm">نام نقش<input {...editForm.register('name')} disabled={!canUpdateRole} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2" />{editForm.formState.errors.name && <small className="mt-1 block text-destructive">{editForm.formState.errors.name.message}</small>}</label>
            <label className="block text-sm">توضیحات<textarea {...editForm.register('description')} disabled={!canUpdateRole} className="mt-1 min-h-24 w-full rounded-md border border-border bg-background px-3 py-2" />{editForm.formState.errors.description && <small className="mt-1 block text-destructive">{editForm.formState.errors.description.message}</small>}</label>
            {editForm.formState.errors.root?.message && <small className="mt-1 block text-destructive">{String(editForm.formState.errors.root.message)}</small>}<DialogFooter><button type="button" className="app-action" onClick={() => setEditingRoleId(null)}>انصراف</button><button type="submit" className="app-action" disabled={!canUpdateRole}>{loading ? displayCopy.loading : 'ذخیره تغییرات'}</button></DialogFooter>
          </form>}
        </DialogContent>
      </Dialog>

      <Dialog open={deletingRoleId !== null} onOpenChange={(open) => { if (!open) setDeletingRoleId(null) }}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>حذف نقش</DialogTitle><DialogDescription>آیا از حذف نقش «{deletingRole?.name}» مطمئن هستید؟</DialogDescription></DialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <DialogFooter><button type="button" className="app-action" onClick={() => setDeletingRoleId(null)}>انصراف</button><button type="button" className="app-action" disabled={!canDeleteRole} onClick={confirmDelete}>{loading ? displayCopy.loading : 'حذف نقش'}</button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
