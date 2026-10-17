import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Search,
  Filter,
  Grid3X3,
  List,
  Plus,
  ClipboardList,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { priorityConfig, typeConfig } from "@/config/taskMetadata";
import { useProjectStatus } from "@/contexts/ProjectStatusContext";
import { useProjectTasks } from "@/contexts/ProjectTaskContext";
import { toPersianDigits } from "@/lib/persian-numbers";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { UserAvatar } from "@/components/UserAvatar";
import { useMembers } from "@/contexts/MembersContext";
import { useSprints } from "@/contexts/SprintsContext";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import {
  getCurrentJalaliComparableDate,
  formatJalaliDate,
  toJalaliDate,
  toJalaliComparableDate,
} from "@/utils/jalaliDate";
import {
  filterTasksByQuickFilter,
  parseQuickTaskFilter,
} from "@/utils/taskQuickFilter";
import { useOptionalTerminalStatusPolicy } from "@/contexts/TerminalStatusPolicyContext";

type ViewMode = "grid" | "list";

function formatDueDateStatus(dueDate: string | undefined, completed: boolean) {
  if (completed)
    return {
      label: "تکمیل‌شده",
      className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    };
  if (!dueDate)
    return {
      label: "بدون سررسید",
      className: "bg-muted text-muted-foreground",
    };

  const date = toJalaliDate(dueDate);
  if (!date)
    return {
      label: "بدون سررسید",
      className: "bg-muted text-muted-foreground",
    };
  const { year, month, day } = date;

  const todayParts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const readPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(todayParts.find((part) => part.type === type)?.value);
  const todayYear = readPart("year");
  const todayMonth = readPart("month");
  const todayDay = readPart("day");
  if (![todayYear, todayMonth, todayDay].every(Number.isFinite))
    return {
      label: "بدون سررسید",
      className: "bg-muted text-muted-foreground",
    };

  const serial = (y: number, m: number, d: number) =>
    y * 365 +
    Math.floor((y * 8 + 21) / 33) +
    (m <= 6 ? (m - 1) * 31 : 186 + (m - 7) * 30) +
    d;
  const difference =
    serial(year, month, day) - serial(todayYear, todayMonth, todayDay);
  if (difference === 0)
    return {
      label: "امروز",
      className: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    };
  if (difference > 0)
    return {
      label: `${toPersianDigits(difference)} روز مانده`,
      className:
        difference <= 2
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    };
  return {
    label: `${toPersianDigits(Math.abs(difference))} روز تأخیر`,
    className: "bg-red-500/10 text-red-600 dark:text-red-400",
  };
}

function formatDueDate(dueDate: string | undefined) {
  const value = formatJalaliDate(dueDate)
  return value ? toPersianDigits(value) : 'بدون سررسید'
}

export default function TasksPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams();
  const { statuses } = useProjectStatus();
  const {
    tasks,
    loading: taskLoading,
    capabilities: taskCapabilities,
    createTask,
    refreshTasks,
  } = useProjectTasks();
  const { members } = useMembers();
  const { currentMember } = useCurrentUser();
  const { sprints } = useSprints();
  const terminalStatusPolicy = useOptionalTerminalStatusPolicy();
  const terminalStatusIds = useMemo(
    () => terminalStatusPolicy?.getTerminalStatusIds(projectId ?? "") ?? [],
    [projectId, terminalStatusPolicy],
  );
  const projectPath = `/projects/${projectId}`;
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [type, setType] = useState("all");
  const [assignee, setAssignee] = useState("all");
  const [sprint, setSprint] = useState("all");
  const [sort, setSort] = useState("newest");
  const [showFilters, setShowFilters] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const canCreateTask = Boolean(
    projectId &&
    statuses.length > 0 &&
    !taskLoading &&
    taskCapabilities.canCreateTask &&
    createTask,
  );
  const quickFilter = parseQuickTaskFilter(
    new URLSearchParams(location.search).get("quick"),
  );

  useEffect(() => {
    void refreshTasks().catch(() => undefined);
  }, [projectId, refreshTasks]);

  useEffect(() => {
    if (
      !(location.state as { openCreateTask?: boolean } | null)?.openCreateTask
    )
      return;

    // The route state is a one-time external navigation intent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCreateTaskOpen(true);
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: null,
    });
  }, [
    location.hash,
    location.pathname,
    location.search,
    location.state,
    navigate,
  ]);

  const normalizedSearch = search.trim().toLocaleLowerCase("fa");
  const filtered = useMemo(
    () =>
      filterTasksByQuickFilter(
        tasks,
        projectId,
        quickFilter,
        currentMember?.id,
        getCurrentJalaliComparableDate(),
        terminalStatusIds,
      )
        .filter((task) => {
          if (
            normalizedSearch &&
            !task.title.toLocaleLowerCase("fa").includes(normalizedSearch) &&
            !task.key.toLocaleLowerCase("fa").includes(normalizedSearch)
          )
            return false;
          if (status !== "all" && task.status !== status) return false;
          if (priority !== "all" && task.priority !== priority) return false;
          if (type !== "all" && task.type !== type) return false;
          if (assignee !== "all" && task.assignee !== assignee) return false;
          if (sprint === "active" && !task.sprintId) return false;
          if (sprint === "backlog" && task.sprintId) return false;
          return true;
        })
        .sort((a, b) => {
          const firstDate = toJalaliComparableDate(a.createdAt);
          const secondDate = toJalaliComparableDate(b.createdAt);
          if (firstDate === undefined) return secondDate === undefined ? 0 : 1;
          if (secondDate === undefined) return -1;
          return sort === "newest"
            ? secondDate - firstDate
            : firstDate - secondDate;
        }),
    [
      tasks,
      projectId,
      quickFilter,
      currentMember?.id,
      terminalStatusIds,
      normalizedSearch,
      status,
      priority,
      type,
      assignee,
      sprint,
      sort,
    ],
  );

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const update =
    (setter: (value: string) => void) =>
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      setter(event.target.value);
      setPage(1);
    };
  const selectClass =
    "h-8 rounded-lg border border-border/70 bg-surface-interactive px-2 text-[11px] text-muted-foreground outline-none focus:border-primary/50";
  const getStatusDisplay = (statusId: string) =>
    statuses.find((item) => item.id === statusId) ?? {
      id: statusId,
      name: "بدون وضعیت",
      color: "#6b7280",
    };
  const getSprintDisplay = (sprintId: string | undefined) => {
    if (!sprintId) return "بدون اسپرینت";

    return (
      sprints.find(
        (item) => item.id === sprintId && item.projectId === projectId,
      )?.name ?? "اسپرینت نامشخص"
    );
  };
  const clearQuickFilter = () => {
    const params = new URLSearchParams(location.search);
    params.delete("quick");
    const search = params.toString();
    navigate({
      pathname: location.pathname,
      search: search ? `?${search}` : "",
      hash: location.hash,
    });
  };
  const quickFilterLabel =
    quickFilter === "mine"
      ? "محول‌شده به من"
      : quickFilter === "created-by-me"
        ? "ایجادشده توسط من"
        : quickFilter === "completed"
          ? "تکمیل‌شده"
          : quickFilter === "due-today"
            ? "سررسید امروز"
            : quickFilter === "overdue"
              ? "عقب‌افتاده"
              : undefined;

  return (
    <div className="space-y-5" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <ClipboardList className="mt-1 size-5 text-muted-foreground" />
          <div>
            <h1 className="text-xl font-bold text-foreground">فهرست وظایف</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              {toPersianDigits(filtered.length)} وظیفه
            </p>
          </div>
        </div>
        <button
          onClick={() => setCreateTaskOpen(true)}
          disabled={!canCreateTask}
          className="app-action disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-4" />
          وظیفه جدید
        </button>
      </header>

      <section className="karnex-card overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-border/70 p-3">
          <div className="relative min-w-[220px] flex-1 lg:max-w-xs">
            <Search className="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="جستجو در وظایف..."
              className="surface-inset h-9 w-full rounded-xl pr-9 pl-3 text-xs text-foreground outline-none focus:ring-2 focus:ring-primary/25"
            />
          </div>
          <button
            onClick={() => setShowFilters((value) => !value)}
            aria-expanded={showFilters}
            className="flex h-8 items-center gap-1.5 rounded-lg border border-border/70 bg-surface-interactive px-3 text-xs text-foreground"
          >
            <Filter className="size-3.5" />
            فیلترها
          </button>
          {quickFilterLabel && (
            <button
              type="button"
              onClick={clearQuickFilter}
              className="flex h-8 items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-3 text-xs text-primary"
            >
              {quickFilterLabel} ×
            </button>
          )}
          {showFilters && (
            <>
              <select
                value={priority}
                onChange={update(setPriority)}
                className={selectClass}
              >
                <option value="all">همه اولویت‌ها</option>
                <option value="highest">خیلی زیاد</option>
                <option value="high">زیاد</option>
                <option value="medium">متوسط</option>
                <option value="low">کم</option>
              </select>
              <select
                value={type}
                onChange={update(setType)}
                className={selectClass}
              >
                <option value="all">همه نوع‌ها</option>
                <option value="task">تسک</option>
                <option value="story">استوری</option>
                <option value="bug">باگ</option>
                <option value="epic">اپیک</option>
              </select>
              <select
                value={status}
                onChange={update(setStatus)}
                className={selectClass}
              >
                <option value="all">همه وضعیت‌ها</option>
                {statuses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                value={assignee}
                onChange={update(setAssignee)}
                className={selectClass}
              >
                <option value="all">همه مسئول‌ها</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <select
                value={sprint}
                onChange={update(setSprint)}
                className={selectClass}
              >
                <option value="all">همه اسپرینت‌ها</option>
                <option value="active">دارای اسپرینت</option>
                <option value="backlog">بک‌لاگ</option>
              </select>
              <div className="mr-auto flex items-center gap-2">
                <select
                  value={sort}
                  onChange={update(setSort)}
                  className={selectClass}
                >
                  <option value="newest">مرتب‌سازی: جدیدترین</option>
                  <option value="oldest">مرتب‌سازی: قدیمی‌ترین</option>
                </select>
              </div>
            </>
          )}
          <div className="surface-inset flex rounded-lg p-1">
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-md p-1.5 ${viewMode === "list" ? "surface-interactive text-primary" : "text-muted-foreground"}`}
            >
              <List className="size-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`rounded-md p-1.5 ${viewMode === "grid" ? "surface-interactive text-primary" : "text-muted-foreground"}`}
            >
              <Grid3X3 className="size-4" />
            </button>
          </div>
        </div>

        {viewMode === "list" && (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1250px] table-fixed border-separate border-spacing-x-0 border-spacing-y-1 px-3 text-right">
              <thead className="text-[10px] text-muted-foreground">
                <tr>
                  {[
                    "کد",
                    "عنوان",
                    "نوع",
                    "وضعیت",
                    "اولویت",
                    "مسئول",
                    "اسپرینت",
                    "تاریخ ایجاد",
                    "زمان سررسید",
                    "زمان باقی‌مانده",
                    "",
                  ].map((h) => (
                    <th
                      key={h}
                      className="whitespace-nowrap px-2 py-2 font-medium first:w-24 last:w-12"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((task) => {
                  const m = members.find((x) => x.id === task.assignee);
                  const tc = typeConfig[task.type];
                  const taskStatus = getStatusDisplay(task.status);
                  const pc = priorityConfig[task.priority];
                  const dueStatus = formatDueDateStatus(
                    task.dueDate,
                    terminalStatusPolicy?.isTaskCompleted(projectId ?? "", task) ?? false,
                  );
                  return (
                    <tr
                      key={task.id}
                      onClick={() =>
                        navigate(`${projectPath}/tasks/${task.id}`)
                      }
                      className="group h-14 cursor-pointer bg-surface-interactive/70 text-xs shadow-sm transition hover:-translate-y-px hover:bg-accent/70"
                    >
                      <td className="rounded-r-xl px-2 text-muted-foreground">
                        <span className="rounded-lg bg-background/60 px-2 py-1">
                          {toPersianDigits(task.key)}
                        </span>
                      </td>
                      <td
                        className="truncate px-2 font-semibold text-foreground"
                        title={task.title}
                      >
                        {task.title}
                      </td>
                      <td className="px-2">
                        <span
                          className="rounded-lg px-2 py-1 text-[10px]"
                          style={{
                            backgroundColor: tc.bgColor,
                            color: tc.color,
                          }}
                        >
                          {tc.label}
                        </span>
                      </td>
                      <td className="px-2">
                        <span
                          className="rounded-full px-2 py-1 text-[10px]"
                          style={{
                            backgroundColor: `${taskStatus.color}26`,
                            color: taskStatus.color,
                          }}
                        >
                          {taskStatus.name}
                        </span>
                      </td>
                      <td className="px-2">
                        <span
                          className="rounded-full px-2 py-1 text-[10px]"
                          style={{
                            backgroundColor: pc.bgColor,
                            color: pc.color,
                          }}
                        >
                          {pc.label}
                        </span>
                      </td>
                      <td className="px-2">
                        {m && (
                          <span className="flex items-center gap-2">
                            <UserAvatar avatarId={m.avatarId} name={m.name} className="size-6" />
                            {m.name}
                          </span>
                        )}
                      </td>
                      <td className="px-2 text-muted-foreground">
                        {getSprintDisplay(task.sprintId)}
                      </td>
                      <td className="px-2 text-muted-foreground">
                        {toPersianDigits(task.createdAt)}
                      </td>
                      <td className="px-2 text-muted-foreground">
                        {formatDueDate(task.dueDate)}
                      </td>
                      <td className="rounded-l-xl whitespace-nowrap px-2">
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] ${dueStatus.className}`}
                        >
                          {dueStatus.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {viewMode === "list" && (
          <div className="grid gap-2 p-3 md:hidden">
            {visible.map((task) => {
              const m = members.find((x) => x.id === task.assignee);
              return (
                <button
                  key={task.id}
                  onClick={() => navigate(`${projectPath}/tasks/${task.id}`)}
                  className="surface-interactive rounded-xl p-3 text-right"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-foreground">
                      {task.title}
                    </span>
                    <span className="text-[10px] text-primary">
                      {toPersianDigits(task.key)}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{getStatusDisplay(task.status).name}</span>
                    <span>{priorityConfig[task.priority].label}</span>
                    {m && (
                      <span className="flex items-center gap-1">
                        <UserAvatar avatarId={m.avatarId} name={m.name} className="size-5" />
                        {m.name}
                      </span>
                    )}
                    <span className="mr-auto">
                      {formatDueDate(task.dueDate)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {viewMode === "grid" && (
          <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((task) => {
              const m = members.find((x) => x.id === task.assignee);
              const tc = typeConfig[task.type];
              const taskStatus = getStatusDisplay(task.status);
              const pc = priorityConfig[task.priority];
              const dueStatus = formatDueDateStatus(task.dueDate, terminalStatusPolicy?.isTaskCompleted(projectId ?? "", task) ?? false);
              return (
                <article
                  key={task.id}
                  onClick={() => navigate(`${projectPath}/tasks/${task.id}`)}
                  className="surface-interactive group flex h-[190px] cursor-pointer flex-col rounded-2xl p-3 text-right outline-none transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_10px_24px_hsl(var(--depth-shadow)/0.24)] focus-within:ring-2 focus-within:ring-primary/30"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-lg border border-primary/15 bg-background/55 px-2.5 py-1 text-[10px] font-semibold text-primary">
                      {toPersianDigits(task.key)}
                    </span>
                  </div>
                  <div className="mt-2 flex min-w-0 items-center justify-between gap-3">
                    <h3
                      className="line-clamp-1 min-w-0 text-sm font-semibold text-foreground"
                      title={task.title}
                    >
                      {task.title}
                    </h3>
                    <div className="flex shrink-0 gap-1.5">
                      <span
                        className="rounded-lg px-2 py-1 text-[9px]"
                        style={{
                          backgroundColor: `${taskStatus.color}26`,
                          color: taskStatus.color,
                        }}
                      >
                        {taskStatus.name}
                      </span>
                      <span
                        className="rounded-lg px-2 py-1 text-[9px]"
                        style={{ backgroundColor: pc.bgColor, color: pc.color }}
                      >
                        {pc.label}
                      </span>
                      <span
                        className="rounded-lg px-2 py-1 text-[9px]"
                        style={{ backgroundColor: tc.bgColor, color: tc.color }}
                      >
                        {tc.label}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 divide-x divide-x-reverse divide-border/60 rounded-xl border border-border/55 bg-background/25 px-2 py-2 text-[9px] text-muted-foreground">
                    <span className="px-2">
                      مسئول
                      {m ? (
                        <b className="mt-1 flex items-center gap-1.5 truncate text-[10px] font-medium text-foreground">
                          <UserAvatar avatarId={m.avatarId} name={m.name} className="size-5" />
                          {m.name}
                        </b>
                      ) : (
                        <b className="block">-</b>
                      )}
                    </span>
                    <span className="px-2">
                      اسپرینت
                      <b className="mt-1 block truncate text-[10px] font-medium text-foreground">
                        {getSprintDisplay(task.sprintId)}
                      </b>
                    </span>
                    <span className="px-2">
                      مهلت
                      <b className="mt-1 block truncate text-[10px] font-medium text-foreground">
                        {formatDueDate(task.dueDate)}
                      </b>
                      <em
                        className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] not-italic ${dueStatus.className}`}
                      >
                        {dueStatus.label}
                      </em>
                    </span>
                  </div>
                  <div className="mt-auto flex items-center justify-between border-t border-border/50 pt-2 text-[9px] text-muted-foreground">
                    <span>ایجاد: {toPersianDigits(task.createdAt)}</span>
                    <span className="rounded-md bg-background/40 px-2 py-1">
                      {toPersianDigits(task.storyPoints ?? 0)} امتیاز
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {visible.length === 0 && (
          <div className="grid min-h-40 place-items-center px-4 text-center text-sm text-muted-foreground">
            {tasks.length
              ? "نتیجه‌ای برای جستجو یا فیلترهای انتخاب‌شده پیدا نشد."
              : "هنوز وظیفه‌ای برای این پروژه وجود ندارد."}
          </div>
        )}

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 px-4 py-3 text-xs text-muted-foreground">
          <span>
            نمایش {toPersianDigits(visible.length)} از{" "}
            {toPersianDigits(filtered.length)} وظیفه
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setPage(currentPage - 1)}
              className="rounded-lg p-2 disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
            {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                onClick={() => setPage(n)}
                className={`size-8 rounded-lg ${n === currentPage ? "surface-interactive text-foreground" : "hover:bg-accent"}`}
              >
                {toPersianDigits(n)}
              </button>
            ))}
            <button
              disabled={currentPage === pages}
              onClick={() => setPage(currentPage + 1)}
              className="rounded-lg p-2 disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>
          <label className="flex items-center gap-2">
            نمایش:
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className={selectClass}
              aria-label="تعداد وظایف در صفحه"
            >
              <option value={10}>۱۰</option>
              <option value={20}>۲۰</option>
              <option value={30}>۳۰</option>
            </select>
          </label>
        </footer>
      </section>
      <CreateTaskDialog
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
      />
    </div>
  );
}
