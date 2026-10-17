import { useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  CalendarDays, ChevronLeft, ChevronRight, File as FileIcon,
  FileArchive, FileImage, FileText, Folder, FolderOpen, Grid3X3,
  Image, List, Search, Upload, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFiles } from '@/contexts/FilesContext'
import './FilesPage.css'

type ViewMode = 'grid' | 'list'
type FileType = 'image' | 'pdf' | 'doc' | 'design'
const fa = new Intl.NumberFormat('fa-IR')
const typeMeta = {
  image: { label: 'تصویر', icon: FileImage }, pdf: { label: 'PDF', icon: FileText },
  doc: { label: 'سند', icon: FileArchive }, design: { label: 'طراحی', icon: Image },
}

function inferType(name: string): FileType {
  const extension = name.split('.').pop()?.toLowerCase()
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(extension ?? '')) return 'image'
  if (extension === 'pdf') return 'pdf'
  if (['fig', 'sketch', 'xd'].includes(extension ?? '')) return 'design'
  return 'doc'
}
function readableSize(bytes: number) { return bytes >= 1_048_576 ? `${fa.format(Number((bytes / 1_048_576).toFixed(1)))} MB` : `${fa.format(Math.max(1, Math.round(bytes / 1024)))} KB` }

export default function FilesPage() {
  const { serviceAvailable, loading, error, files, folders, currentFolderId, uploads, storageUsage, capabilities, displayCopy, uploadFile, downloadFile } = useFiles()
  const storagePercent = storageUsage?.quotaBytes ? Math.min(100, (storageUsage.usedBytes / storageUsage.quotaBytes) * 100) : 0
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [pageSize, setPageSize] = useState('6')
  const [page, setPage] = useState(1)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [pending, setPending] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const canUpload = serviceAvailable && !loading && capabilities.canUpload && Boolean(uploadFile)
  const canDownload = serviceAvailable && !loading && capabilities.canDownload && Boolean(downloadFile)

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('fa')
    return files.filter(file => {
      const type = inferType(file.name)
      return (typeFilter === 'all' || type === typeFilter) && (!query || [file.name, typeMeta[type].label, type, file.createdById ?? ''].some(value => value.toLocaleLowerCase('fa').includes(query)))
    })
  }, [files, search, typeFilter])
  const size = Number(pageSize), pages = Math.max(1, Math.ceil(filtered.length / size)), safePage = Math.min(page, pages)
  const visible = filtered.slice((safePage - 1) * size, safePage * size)
  const first = filtered.length ? (safePage - 1) * size + 1 : 0, last = Math.min(safePage * size, filtered.length)

  function addPending(list: FileList | null) { if (list) setPending(current => [...current, ...Array.from(list)]) }
  function dropFiles(event: DragEvent<HTMLDivElement>) { event.preventDefault(); setDragging(false); addPending(event.dataTransfer.files) }
  function chooseFiles(event: ChangeEvent<HTMLInputElement>) { addPending(event.target.files); event.target.value = '' }
  function closeUploadDialog() { setUploadOpen(false); setPending([]); setDragging(false) }
  async function uploadPending() {
    if (!canUpload || !uploadFile || pending.length === 0) return
    const results = await Promise.all(pending.map(file => uploadFile({ file, folderId: currentFolderId })))
    if (results.every(result => result.ok)) closeUploadDialog()
  }

  return <main className="files-page" dir="rtl">
    <header className="files-header"><div><h1>فایل‌ها</h1><p>{serviceAvailable ? `${fa.format(filtered.length)} فایل` : displayCopy.filesUnavailable}</p></div><div className="files-actions"><Button disabled={!canUpload} title={displayCopy.actionUnavailable} onClick={() => setUploadOpen(true)}><Upload />آپلود</Button></div></header>
    <div className="files-toolbar">
      <div className="files-filters"><label><Search /><input value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} placeholder="جستجو در فایل‌ها..." /></label><Select value={typeFilter} onValueChange={value => { setTypeFilter(value); setPage(1) }} dir="rtl"><SelectTrigger aria-label="نوع فایل"><SelectValue /></SelectTrigger><SelectContent dir="rtl"><SelectItem value="all">همه انواع</SelectItem><SelectItem value="image">تصویر</SelectItem><SelectItem value="pdf">PDF</SelectItem><SelectItem value="doc">سند</SelectItem><SelectItem value="design">طراحی</SelectItem></SelectContent></Select></div>
      <div className="view-toggle"><button className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} aria-label="نمایش فهرستی"><List /></button><button className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} aria-label="نمایش شبکه‌ای"><Grid3X3 /></button></div>
    </div>
    <div className="files-layout">
      <div className="files-main">
        <section className="file-stats">
          {[{ title: 'آپلودهای فعال', value: uploads.filter(upload => upload.state === 'uploading').length, unit: 'فایل', icon: CalendarDays, tone: 'purple' }, { title: 'حجم کل', value: storageUsage ? readableSize(storageUsage.usedBytes) : '—', unit: '', icon: FileIcon, tone: 'orange' }, { title: 'پوشه‌ها', value: folders.length, unit: 'پوشه', icon: Folder, tone: 'green' }, { title: 'کل فایل‌ها', value: files.length, unit: 'فایل', icon: FileArchive, tone: 'blue' }].map(item => <article key={item.title}><i className={item.tone}><item.icon /></i><div><span>{item.title}</span><strong>{typeof item.value === 'number' ? fa.format(item.value) : item.value}</strong><small>{item.unit}</small></div></article>)}
        </section>
        <section className="folders-panel"><header><h2>پوشه‌ها</h2></header><div>{!serviceAvailable ? <p>{displayCopy.foldersUnavailable}</p> : folders.map(folder => <article key={folder.id}><FolderOpen /><div><strong>{folder.name}</strong><span>{fa.format(files.filter(file => file.folderId === folder.id).length)} فایل</span></div><time>{folder.updatedAt}</time></article>)}</div></section>
        <section className="files-content">
          {!serviceAvailable ? <div className="files-empty"><FileArchive /><h2>{displayCopy.serviceUnavailable}</h2><p>{error ?? displayCopy.filesUnavailable}</p></div> : !visible.length ? <div className="files-empty"><FileArchive /><h2>فایلی پیدا نشد</h2><p>عبارت جستجو یا نوع فایل را تغییر دهید.</p></div> : viewMode === 'list' ? <div className="files-table-wrap"><table><thead><tr><th>نام فایل</th><th>نوع</th><th>اندازه</th><th>تاریخ تغییر</th><th>تغییر توسط</th></tr></thead><tbody>{visible.map(file => { const type = inferType(file.name), Icon = typeMeta[type].icon; return <tr key={file.id} onDoubleClick={() => canDownload && downloadFile && void downloadFile(file.id)}><td><span className={`table-file-icon ${type}`}><Icon /></span><b dir="ltr">{file.name}</b></td><td><span className={`type-badge ${type}`}>{typeMeta[type].label}</span></td><td>{readableSize(file.metadata.sizeBytes)}</td><td><strong>{file.updatedAt}</strong></td><td>{file.createdById ?? '—'}</td></tr>})}</tbody></table></div> : <div className="files-card-grid">{visible.map(file => { const type = inferType(file.name), Icon = typeMeta[type].icon; return <article key={file.id} onDoubleClick={() => canDownload && downloadFile && void downloadFile(file.id)}><div className={`grid-file-icon ${type}`}><Icon /></div><b dir="ltr">{file.name}</b><span>{typeMeta[type].label} · {readableSize(file.metadata.sizeBytes)}</span><time>{file.updatedAt}</time></article>})}</div>}
          <footer className="file-pagination"><div><button disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronRight /></button><button className="active">{fa.format(safePage)}</button><button disabled={safePage === pages} onClick={() => setPage(p => Math.min(pages, p + 1))}><ChevronLeft /></button></div><span>نمایش {fa.format(first)} تا {fa.format(last)} از {fa.format(filtered.length)} فایل</span><label>تعداد در صفحه<Select value={pageSize} onValueChange={value => { setPageSize(value); setPage(1) }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="6">۶</SelectItem><SelectItem value="12">۱۲</SelectItem><SelectItem value="20">۲۰</SelectItem></SelectContent></Select></label></footer>
        </section>
      </div>
      <aside className="files-side">
        <section className="storage-panel"><h2>حجم فضای ذخیره‌سازی</h2><div className="storage-overview"><div className="storage-ring" style={{ background: storageUsage?.quotaBytes ? `conic-gradient(#3b82f6 0 ${storagePercent}%, hsl(var(--secondary)) ${storagePercent}% 100%)` : 'hsl(var(--secondary))' }}><span /></div><div><strong>{storageUsage ? readableSize(storageUsage.usedBytes) : '—'}</strong><p>{storageUsage?.quotaBytes ? `از ${readableSize(storageUsage.quotaBytes)} استفاده شده` : displayCopy.storageUsageUnavailable}</p><small>{storageUsage?.quotaBytes ? `${fa.format(Math.round(storagePercent))}٪` : ''}</small></div></div><div className="storage-bar"><i style={{ width: `${storagePercent}%` }} /></div></section>
        <section className="activity-panel"><h2>آخرین فعالیت‌ها</h2>{serviceAvailable ? files.slice().sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 5).map(file => { const type = inferType(file.name), Icon = typeMeta[type].icon; return <article key={file.id}><i className={type}><Icon /></i><div><strong dir="ltr">{file.name}</strong><span>{file.createdById ?? '—'}</span></div><time>{file.updatedAt}</time></article>}) : <p>{displayCopy.filesUnavailable}</p>}</section>
      </aside>
    </div>

    <Dialog open={uploadOpen} onOpenChange={open => { if (open && canUpload) setUploadOpen(true); else closeUploadDialog() }}><DialogContent dir="rtl" className="upload-dialog"><DialogHeader><DialogTitle>افزودن فایل‌ها</DialogTitle><DialogDescription>{displayCopy.actionUnavailable}</DialogDescription></DialogHeader><div className={`upload-drop ${dragging ? 'dragging' : ''}`} onDragEnter={event => { event.preventDefault(); setDragging(true) }} onDragOver={event => event.preventDefault()} onDragLeave={() => setDragging(false)} onDrop={dropFiles} onClick={() => fileInput.current?.click()}><Upload /><strong>فایل‌ها را اینجا رها کنید</strong><span>یا برای انتخاب فایل کلیک کنید</span><input ref={fileInput} type="file" multiple onChange={chooseFiles} hidden /></div>{pending.length > 0 && <div className="pending-files">{pending.map((file, index) => <div key={`${file.name}-${index}`}><FileIcon /><span><b>{file.name}</b><small>{inferType(file.name)} · {readableSize(file.size)}</small></span><button onClick={() => setPending(current => current.filter((_, i) => i !== index))}><X /></button></div>)}</div>}<p className="upload-note">{displayCopy.actionUnavailable}</p><DialogFooter><Button variant="outline" onClick={closeUploadDialog}>انصراف</Button><Button disabled={!canUpload || !pending.length} onClick={() => void uploadPending()}>افزودن فایل‌ها</Button></DialogFooter></DialogContent></Dialog>
  </main>
}
