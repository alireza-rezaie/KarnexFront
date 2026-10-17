import { useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes } from 'react'
import { Navigate } from 'react-router-dom'
import { UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import type { RuntimeAuthAccount, UpdateRuntimeAccountInput } from '@/types/auth'

type AccountForm = {
  firstName: string
  lastName: string
  username: string
  email: string
  phone: string
  password: string
}

type AccountEditForm = UpdateRuntimeAccountInput

const emptyForm: AccountForm = {
  firstName: '',
  lastName: '',
  username: '',
  email: '',
  phone: '',
  password: '',
}

export default function UserManagementPage() {
  const { createRuntimeAccount, currentUserId, isSystemAdmin, runtimeAccounts = [], setRuntimeAccountActive, setRuntimeAccountRole, updateRuntimeAccount } = useAuth()
  const [form, setForm] = useState<AccountForm>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<AccountEditForm | null>(null)

  if (!isSystemAdmin) return <Navigate to="/dashboard" replace />

  const updateField = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setNotice(null)

    if (Object.values(form).some((value) => !value.trim())) {
      setError('همهٔ فیلدهای حساب کاربری الزامی هستند.')
      return
    }
    if (!createRuntimeAccount) {
      setError('ایجاد حساب کاربری در دسترس نیست.')
      return
    }

    setPending(true)
    const result = await createRuntimeAccount(form)
    setPending(false)
    if (!result.ok) {
      setError(result.message ?? 'ایجاد حساب کاربری انجام نشد.')
      return
    }

    setForm(emptyForm)
    setNotice(`حساب «${result.account.username}» ایجاد شد.`)
  }

  const startEdit = (account: RuntimeAuthAccount) => {
    setError(null)
    setNotice(null)
    setEditingAccountId(account.id)
    setEditForm({ firstName: account.firstName, lastName: account.lastName, username: account.username, email: account.email, phone: account.phone })
  }

  const submitEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingAccountId || !editForm || !updateRuntimeAccount) return
    setError(null)
    setNotice(null)
    if (Object.values(editForm).some((value) => !value.trim())) {
      setError('همهٔ فیلدهای اطلاعات حساب الزامی هستند.')
      return
    }

    setPending(true)
    const result = await updateRuntimeAccount(editingAccountId, editForm)
    setPending(false)
    if (!result.ok) {
      setError(result.message ?? 'ویرایش حساب انجام نشد.')
      return
    }
    setEditingAccountId(null)
    setEditForm(null)
    setNotice('اطلاعات حساب به‌روزرسانی شد.')
  }

  const changeActiveState = async (account: RuntimeAuthAccount) => {
    if (!setRuntimeAccountActive) return
    setError(null)
    setNotice(null)
    setPending(true)
    const result = await setRuntimeAccountActive(account.id, !account.isActive)
    setPending(false)
    if (!result.ok) {
      setError(result.message ?? 'تغییر وضعیت حساب انجام نشد.')
      return
    }
    setNotice(account.isActive ? 'حساب کاربری غیرفعال شد.' : 'حساب کاربری فعال شد.')
  }

  const changeRole = async (account: RuntimeAuthAccount, accountRole: RuntimeAuthAccount['accountRole']) => {
    if (!setRuntimeAccountRole || accountRole === account.accountRole) return
    setError(null)
    setNotice(null)
    setPending(true)
    const result = await setRuntimeAccountRole(account.id, accountRole)
    setPending(false)
    if (!result.ok) { setError(result.message ?? 'تغییر نقش کاربر انجام نشد.'); return }
    setNotice('نقش کاربر به‌روزرسانی شد.')
  }

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6" dir="rtl">
      <header className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">مدیریت در سطح سیستم</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">مدیریت کاربران</h1>
          <p className="mt-2 text-sm text-muted-foreground">حساب‌ها فقط در حافظهٔ نشست فعلی نگهداری می‌شوند و به پروژه‌ای دسترسی نمی‌دهند.</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="size-4" />{runtimeAccounts.length} حساب کاربری</div>
      </header>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex items-center gap-2"><UserPlus className="size-5 text-primary" /><h2 className="text-lg font-semibold">ایجاد حساب کاربری</h2></div>
        <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <Field label="نام" name="firstName" value={form.firstName} onChange={updateField} disabled={pending} />
          <Field label="نام خانوادگی" name="lastName" value={form.lastName} onChange={updateField} disabled={pending} />
          <Field label="نام کاربری" name="username" value={form.username} onChange={updateField} disabled={pending} dir="ltr" />
          <Field label="ایمیل" name="email" type="email" value={form.email} onChange={updateField} disabled={pending} dir="ltr" />
          <Field label="شمارهٔ تماس" name="phone" value={form.phone} onChange={updateField} disabled={pending} dir="ltr" />
          <Field label="رمز عبور" name="password" type="password" value={form.password} onChange={updateField} disabled={pending} dir="ltr" />
          {(error || notice) && <p className={`sm:col-span-2 text-sm ${error ? 'text-destructive' : 'text-emerald-600'}`} role={error ? 'alert' : 'status'}>{error ?? notice}</p>}
          <div className="sm:col-span-2"><Button type="submit" disabled={pending}>{pending ? 'در حال ایجاد…' : 'ایجاد کاربر'}</Button></div>
        </form>
      </section>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-4 sm:px-5"><h2 className="font-semibold">فهرست حساب‌های runtime</h2></div>
        {runtimeAccounts.length === 0 ? <p className="p-5 text-sm text-muted-foreground">حسابی در این نشست وجود ندارد.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="bg-muted/40 text-muted-foreground"><tr><th className="px-4 py-3 font-medium">نام</th><th className="px-4 py-3 font-medium">نام کاربری</th><th className="px-4 py-3 font-medium">ایمیل</th><th className="px-4 py-3 font-medium">وضعیت</th><th className="px-4 py-3 font-medium">نوع حساب</th><th className="px-4 py-3 font-medium">عملیات</th></tr></thead><tbody>{runtimeAccounts.map((account) => <tr className="border-t border-border" key={account.id}><td className="px-4 py-3 font-medium">{account.firstName} {account.lastName}{account.id === currentUserId && <span className="mr-2 text-xs font-normal text-primary">(شما)</span>}</td><td className="px-4 py-3" dir="ltr">{account.username}</td><td className="px-4 py-3" dir="ltr">{account.email}</td><td className="px-4 py-3">{account.isActive ? 'فعال' : 'غیرفعال'}</td><td className="px-4 py-3">{account.accountRole === 'system-admin' ? 'مدیر سیستم' : 'کاربر'}</td><td className="px-4 py-3"><div className="flex gap-2"><Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => startEdit(account)}>ویرایش</Button><Button type="button" size="sm" variant={account.isActive ? 'destructive' : 'secondary'} disabled={pending || (account.id === currentUserId && account.isActive)} onClick={() => void changeActiveState(account)}>{account.isActive ? 'غیرفعال‌سازی' : 'فعال‌سازی'}</Button></div></td></tr>)}</tbody></table></div>
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="mb-3 text-lg font-semibold">نقش کاربران</h2>
        <div className="space-y-2">
          {runtimeAccounts.map((account) => <label key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"><span>{account.firstName} {account.lastName}</span><select aria-label={`نقش ${account.username}`} value={account.accountRole} disabled={pending || account.id === currentUserId} onChange={(event) => void changeRole(account, event.target.value as RuntimeAuthAccount['accountRole'])} className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"><option value="user">کاربر</option><option value="system-admin">مدیر سیستم</option></select></label>)}
        </div>
      </section>

      {editingAccountId && editForm && <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5"><h2 className="mb-4 text-lg font-semibold">ویرایش حساب کاربری</h2><form className="grid gap-4 sm:grid-cols-2" onSubmit={submitEdit}><Field label="نام" name="firstName" value={editForm.firstName} onChange={(event) => setEditForm((current) => current && { ...current, firstName: event.target.value })} disabled={pending} /><Field label="نام خانوادگی" name="lastName" value={editForm.lastName} onChange={(event) => setEditForm((current) => current && { ...current, lastName: event.target.value })} disabled={pending} /><Field label="نام کاربری" name="username" value={editForm.username} onChange={(event) => setEditForm((current) => current && { ...current, username: event.target.value })} disabled={pending} dir="ltr" /><Field label="ایمیل" name="email" type="email" value={editForm.email} onChange={(event) => setEditForm((current) => current && { ...current, email: event.target.value })} disabled={pending} dir="ltr" /><Field label="شمارهٔ تماس" name="phone" value={editForm.phone} onChange={(event) => setEditForm((current) => current && { ...current, phone: event.target.value })} disabled={pending} dir="ltr" /><div className="flex items-end gap-2"><Button type="submit" disabled={pending}>ذخیره تغییرات</Button><Button type="button" variant="outline" disabled={pending} onClick={() => { setEditingAccountId(null); setEditForm(null) }}>انصراف</Button></div></form></section>}
    </main>
  )
}

function Field({ label, ...inputProps }: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return <label className="grid gap-1.5 text-sm font-medium text-foreground">{label}<input className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50" required {...inputProps} /></label>
}
