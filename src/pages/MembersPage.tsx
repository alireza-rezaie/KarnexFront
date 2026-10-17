import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft, ChevronRight, Crown, Gauge, MoreHorizontal, Search,
  Users, UsersRound, Wifi,
} from 'lucide-react'
import { useMembers } from '@/contexts/MembersContext'
import { useAuth } from '@/contexts/AuthContext'
import { useRoles } from '@/contexts/RolesContext'
import { useProjects } from '@/contexts/ProjectsContext'
import type { Member } from '@/types/member'
import { projectRoleLabels } from '@/types/role'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserAvatar } from '@/components/UserAvatar'
import './MembersPage.css'

const fa = new Intl.NumberFormat('fa-IR')
type DisplayMember = Member & { capacity: number; tasks: number; activity: string }

const roleLabel = (roleId: string | undefined, roles: { id: string; name: string }[]) => roles.find((role) => role.id === roleId)?.name ?? (roleId && roleId in projectRoleLabels ? projectRoleLabels[roleId as keyof typeof projectRoleLabels] : undefined)

const statusLabel = { online: 'آنلاین', busy: 'دور کار', offline: 'آفلاین' }

function StatCard({ title, value, subtitle, icon, tone }: { title: string; value: number; subtitle: string; icon: React.ReactNode; tone: string }) {
  return <article className="member-kpi"><div><span>{title}</span><strong>{fa.format(value)}</strong><small>{subtitle}</small></div><i className={tone}>{icon}</i></article>
}

export default function MembersPage() {
  const { members } = useMembers()
  const { isSystemAdmin } = useAuth()
  const navigate = useNavigate()
  const { roles } = useRoles()
  const { projects } = useProjects()
  const [search, setSearch] = useState('')
  const [jobTitleFilter, setJobTitleFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState('8')
  const [viewingMemberId, setViewingMemberId] = useState<Member['id'] | null>(null)

  const memberList = useMemo<DisplayMember[]>(() => members.map((member) => ({
    ...member,
    capacity: 0,
    tasks: 0,
    activity: member.lastActivity,
  })), [members])
  const managerCount = useMemo(() => memberList.filter((member) => {
    const roleName = roleLabel(member.roleId, roles) ?? ''
    return /مدیر|سرپرست/.test(roleName)
  }).length, [memberList, roles])
  const onlineCount = useMemo(() => memberList.filter((member) => member.status === 'online').length, [memberList])
  const jobTitles = useMemo(() => [...new Set(members.map((member) => member.jobTitle).filter(Boolean))], [members])

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fa')
    return memberList.filter(member => {
      if (jobTitleFilter !== 'all' && member.jobTitle !== jobTitleFilter) return false
      return !query || [member.name, member.email, member.jobTitle].some(value => value.toLocaleLowerCase('fa').includes(query))
    })
  }, [memberList, jobTitleFilter, search])
  const size = Number(pageSize)
  const totalPages = Math.max(1, Math.ceil(filtered.length / size))
  const safePage = Math.min(page, totalPages)
  const visible = filtered.slice((safePage - 1) * size, safePage * size)
  const first = filtered.length ? (safePage - 1) * size + 1 : 0
  const last = Math.min(safePage * size, filtered.length)
  const viewingMember = members.find((member) => member.id === viewingMemberId)
  return (
    <main className="members-page" dir="rtl">
      <header className="members-header">
        <div><h1>اعضا</h1><p>{fa.format(memberList.length)} عضو</p></div>
        <div className="members-actions">{isSystemAdmin ? <Button onClick={() => navigate('/admin/users')}>مدیریت کاربران</Button> : <p className="text-sm text-muted-foreground">ایجاد حساب فقط توسط مدیر سیستم انجام می‌شود.</p>}</div>
      </header>

      <div className="members-toolbar">
        <label className="member-search"><Search /><input value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="جستجو در اعضا..." /></label>
        <Select value={jobTitleFilter} onValueChange={value => { setJobTitleFilter(value); setPage(1) }} dir="rtl"><SelectTrigger aria-label="فیلتر عنوان شغلی"><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="all">همه عنوان‌های شغلی</SelectItem>{jobTitles.map(jobTitle => <SelectItem value={jobTitle} key={jobTitle}>{jobTitle}</SelectItem>)}</SelectContent></Select>
      </div>

      <section className="member-kpis" aria-label="خلاصه اعضا">
        <StatCard title="کل اعضا" value={memberList.length} subtitle="تیم شما" icon={<Users />} tone="blue" />
        <StatCard title="اعضای دارای بار کاری بالا" value={memberList.filter((member) => member.capacity >= 90).length} subtitle="دادهٔ ظرفیت در دسترس نیست" icon={<Gauge />} tone="orange" />
        <StatCard title="مدیران" value={managerCount} subtitle="بر اساس نقش دسترسی" icon={<Crown />} tone="purple" />
        <StatCard title="اعضای آنلاین" value={onlineCount} subtitle="بر اساس وضعیت حضور" icon={<Wifi />} tone="green" />
      </section>

      {visible.length ? <section className="members-grid">
        {visible.map(member => {
          const presence = member.status === 'online' ? 'online' : member.status === 'busy' ? 'busy' : 'offline'
          const capacityTone = member.capacity >= 90 ? 'danger' : member.capacity >= 75 ? 'warning' : 'normal'
          return <article className="member-card" key={member.id}>
            <div className="member-card-top">
              <DropdownMenu dir="rtl"><DropdownMenuTrigger asChild><button className="member-menu" aria-label={`گزینه‌های ${member.name}`}><MoreHorizontal /></button></DropdownMenuTrigger><DropdownMenuContent align="start" sideOffset={6} collisionPadding={12} className="min-w-40"><DropdownMenuItem onSelect={() => setViewingMemberId(member.id)}>مشاهده پروفایل</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
              <UserAvatar avatarId={member.avatarId} name={member.name} className="h-[58px] w-[58px] border border-border bg-secondary/45" />
              <div className="member-identity"><h2>{member.name}</h2><span>{member.jobTitle}</span><p>{member.email}</p></div>
              <b className={`presence ${presence}`}><i />{statusLabel[member.status]}</b>
            </div>
            <div className="member-stats">
              <div><strong>{fa.format(member.capacity)}٪</strong><span>ظرفیت</span><em><i className={capacityTone} style={{ width: `${member.capacity}%` }} /></em></div>
              <div><strong>{fa.format(member.tasks)}</strong><span>وظیفه فعال</span></div>
              <div><strong>{fa.format(member.projects.length)}</strong><span>پروژه فعال</span></div>
            </div>
            <footer><i className={presence} />آخرین فعالیت: {member.activity}</footer>
          </article>
        })}
      </section> : <section className="members-empty"><UsersRound /><h2>عضوی پیدا نشد</h2><p>عبارت جستجو یا فیلتر نقش را تغییر دهید.</p></section>}

      <footer className="members-pagination">
        <div className="page-buttons"><button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={safePage === 1} aria-label="صفحه قبل"><ChevronRight /></button><button className="active">{fa.format(safePage)}</button><button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} aria-label="صفحه بعد"><ChevronLeft /></button></div>
        <span>نمایش {fa.format(first)} تا {fa.format(last)} از {fa.format(filtered.length)} عضو</span>
        <label>ردیف در صفحه<Select value={pageSize} onValueChange={value => { setPageSize(value); setPage(1) }} dir="rtl"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="8">۸</SelectItem><SelectItem value="12">۱۲</SelectItem><SelectItem value="20">۲۰</SelectItem></SelectContent></Select></label>
      </footer>

      <Dialog open={viewingMemberId !== null} onOpenChange={(open) => { if (!open) setViewingMemberId(null) }}>
        <DialogContent dir="rtl" className="member-invite"><DialogHeader><DialogTitle>پروفایل عضو</DialogTitle><DialogDescription>اطلاعات فعلی عضو از منبع مشترک اعضا خوانده می‌شود.</DialogDescription></DialogHeader>
          {viewingMember && <div className="dialog-fields"><UserAvatar avatarId={viewingMember.avatarId} name={viewingMember.name} className="h-16 w-16" /><label>نام<strong>{viewingMember.name}</strong></label><label>ایمیل<strong dir="ltr">{viewingMember.email}</strong></label><label>عنوان شغلی<strong>{viewingMember.jobTitle}</strong></label><label>نقش دسترسی<strong>{roleLabel(viewingMember.roleId, roles) ?? 'بدون نقش دسترسی'}</strong></label><label>وضعیت<strong>{statusLabel[viewingMember.status]}</strong></label><label>پروژه‌ها<strong>{viewingMember.projects.length ? viewingMember.projects.map((projectId) => projects.find((project) => project.id === projectId)?.name).filter((name): name is string => Boolean(name)).join('، ') || 'بدون پروژه' : 'بدون پروژه'}</strong></label><label>آخرین فعالیت<strong>{viewingMember.lastActivity}</strong></label></div>}
          <DialogFooter><Button type="button" onClick={() => setViewingMemberId(null)}>بستن</Button></DialogFooter>
        </DialogContent>
      </Dialog>

    </main>
  )
}
