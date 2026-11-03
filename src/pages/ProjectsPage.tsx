import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  FolderKanban,
  Search,
  Grid3X3,
  List,
  Plus,
  Lock,
  Globe,
  Clock,
  TrendingUp,
} from "lucide-react";
import { useProjects } from "@/contexts/ProjectsContext";
import { useMembers } from "@/contexts/MembersContext";
import { projectRoleIds } from "@/types/role";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { UserAvatar } from "@/components/UserAvatar";
import { useWorkflowCatalog } from "@/contexts/WorkflowCatalogContext";
import {
  filterProjectsForView,
  parseProjectView,
  type ProjectListFilter,
} from "@/utils/projectView";

type ViewMode = "grid" | "list";
type FilterStatus = ProjectListFilter;
type FilterButton = FilterStatus | "archived";
type WorkflowChoice = "existing" | "clone" | "create";

const createProjectSchema = (existingKeys: string[]) =>
  z.object({
    name: z.string().trim().min(1, "نام پروژه الزامی است"),
    key: z
      .string()
      .trim()
      .min(1, "کلید پروژه الزامی است")
      .refine(
        (value) =>
          !existingKeys.some(
            (key) =>
              key.toLocaleLowerCase("en-US") ===
              value.toLocaleLowerCase("en-US"),
          ),
        "کلید پروژه تکراری است",
      ),
    type: z.enum(["scrum", "kanban", "basic"]),
    description: z.string(),
  });

type CreateProjectFormValues = z.infer<ReturnType<typeof createProjectSchema>>;

const createProjectDefaultValues: CreateProjectFormValues = {
  name: "",
  key: "",
  type: "scrum",
  description: "",
};

export default function ProjectsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    projects,
    createLoading,
    createError,
    createCapabilities,
    createProject,
    displayCopy,
  } = useProjects();
  const { members, updateMember } = useMembers();
  const { currentMember } = useCurrentUser();
  const workflowCatalog = useWorkflowCatalog();
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] =
    useState("workflow-default");
  const [workflowChoice, setWorkflowChoice] =
    useState<WorkflowChoice>("existing");
  const [cloneWorkflowName, setCloneWorkflowName] = useState("");
  const [cloneWorkflowDescription, setCloneWorkflowDescription] = useState("");
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newWorkflowDescription, setNewWorkflowDescription] = useState("");
  const [workflowSetupError, setWorkflowSetupError] = useState("");
  const [workflowSetupProjectId, setWorkflowSetupProjectId] = useState("");
  const projectView = parseProjectView(
    new URLSearchParams(location.search).get("view"),
  );
  const form = useForm<CreateProjectFormValues>({
    resolver: zodResolver(
      createProjectSchema(projects.map((project) => project.key)),
    ),
    defaultValues: createProjectDefaultValues,
    mode: "onChange",
  });
  const selectedProjectType = useWatch({ control: form.control, name: "type" });
  const watchedCreateProjectValues = useWatch({ control: form.control });
  const canCreateProject = Boolean(
    !createLoading &&
    createCapabilities.canCreateProject &&
    createProject,
  );
  const canSubmitProject = canCreateProject && createProjectSchema(projects.map((project) => project.key)).safeParse(watchedCreateProjectValues).success;
  const selectableWorkflows = workflowCatalog.workflows.filter((workflow) =>
    Boolean(workflowCatalog.getPublishedWorkflow(workflow.id)),
  );

  const filters: { id: FilterButton; label: string }[] = [
    { id: "all", label: "همه" },
    { id: "active", label: "فعال" },
    { id: "archived", label: "آرشیو" },
    { id: "mine", label: "پروژه‌های من" },
    { id: "team", label: "تیم من" },
  ];

  const normalizedSearch = search.trim().toLocaleLowerCase("fa");
  const filteredProjects = filterProjectsForView(
    projects,
    projectView,
    filter,
    currentMember?.projects,
  ).filter(
    (p) =>
      !normalizedSearch ||
      p.name.toLocaleLowerCase("fa").includes(normalizedSearch) ||
      p.key.toLocaleLowerCase("en-US").includes(normalizedSearch),
  );

  const projectTypeLabels: Record<string, string> = {
    scrum: "اسکرام",
    kanban: "کانبان",
    basic: "پایه",
  };
  const openCreateProject = () => {
    form.reset(createProjectDefaultValues);
    setSelectedWorkflowId("workflow-default");
    setWorkflowChoice("existing");
    setCloneWorkflowName("");
    setCloneWorkflowDescription("");
    setNewWorkflowName("");
    setNewWorkflowDescription("");
    setWorkflowSetupError("");
    setWorkflowSetupProjectId("");
    setShowCreateModal(true);
    void workflowCatalog.refresh();
  };
  const setProjectView = (view: "all" | "archived") => {
    const params = new URLSearchParams(location.search);
    if (view === "all") params.delete("view");
    else params.set("view", view);
    const search = params.toString();
    navigate({
      pathname: location.pathname,
      search: search ? `?${search}` : "",
      hash: location.hash,
    });
  };
  const selectFilter = (nextFilter: FilterButton) => {
    if (nextFilter === "archived") {
      setFilter("all");
      setProjectView("archived");
      return;
    }

    setFilter(nextFilter);
    if (nextFilter === "all") setProjectView("all");
  };
  const isFilterActive = (filterId: FilterButton) =>
    filterId === "archived"
      ? projectView === "archived" && filter === "all"
      : filterId === "all"
        ? projectView === "all" && filter === "all"
        : filter === filterId;

  useEffect(() => {
    if (
      !(location.state as { openCreateProject?: boolean } | null)
        ?.openCreateProject
    )
      return;

    form.reset(createProjectDefaultValues);
    // The route state is a one-time external navigation intent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowCreateModal(true);
    navigate(`${location.pathname}${location.search}${location.hash}`, {
      replace: true,
      state: null,
    });
  }, [
    form,
    location.hash,
    location.pathname,
    location.search,
    location.state,
    navigate,
  ]);

  const submitCreateProject = async (values: CreateProjectFormValues) => {
    if (!createProject || !canCreateProject) return;
    const sourceWorkflow =
      workflowCatalog.getPublishedWorkflow(selectedWorkflowId);
    if (!sourceWorkflow) {
      setWorkflowSetupError("گردش‌کار منتشرشدهٔ انتخاب‌شده در دسترس نیست.");
      return;
    }
    if (workflowChoice === "clone" && !cloneWorkflowName.trim()) {
      setWorkflowSetupError("نام گردش‌کار کپی‌شده الزامی است.");
      return;
    }
    if (workflowChoice === "create" && !newWorkflowName.trim()) {
      setWorkflowSetupError("نام گردش‌کار جدید الزامی است.");
      return;
    }

    const result = await createProject({
      name: values.name,
      key: values.key,
      type: values.type,
      description: values.description,
      status: "active",
      privacy: "private",
      icon: "folder-kanban",
      color: "#3b82f6",
      progress: 0,
      members: currentMember ? [currentMember.id] : [],
      ...(currentMember ? { memberRoles: { [currentMember.id]: projectRoleIds.projectManager } } : {}),
      startDate: "",
      endDate: "",
      tasksCount: 0,
      completedTasks: 0,
    });

    if (!result.ok) return;
    if (!result.project) {
      setWorkflowSetupError(
        "پروژه ساخته شد، اما شناسهٔ پروژه برای تنظیم گردش‌کار در دسترس نیست.",
      );
      return;
    }
    // A real creator joins their own project and receives the stable PM key.
    // This is an explicit runtime account action, not a seeded member or role record.
    if (currentMember && updateMember) {
      await updateMember(currentMember.id, {
        projects: [...new Set([...currentMember.projects, result.project.id])],
      });
    }
    let workflowId = sourceWorkflow.workflowId;
    if (workflowChoice === "clone") {
      const clone = await workflowCatalog.cloneWorkflow(
        sourceWorkflow.workflowId,
        {
          name: cloneWorkflowName,
          ownerProjectId: result.project.id,
          ...(cloneWorkflowDescription.trim()
            ? { description: cloneWorkflowDescription }
            : {}),
        },
      );
      if (!clone.ok || !clone.workflow) {
        setWorkflowSetupError(
          `پروژه ساخته شد، اما کپی گردش‌کار انجام نشد: ${!clone.ok ? (clone.message ?? "خطای نامشخص") : "نتیجهٔ نامعتبر"}`,
        );
        setWorkflowSetupProjectId(result.project.id);
        return;
      }
      workflowId = clone.workflow.id;
    }
    if (workflowChoice === "create") {
      const created = await workflowCatalog.createWorkflowDraft({
        name: newWorkflowName,
        ownerProjectId: result.project.id,
        ...(newWorkflowDescription.trim()
          ? { description: newWorkflowDescription }
          : {}),
      });
      if (!created.ok || !created.workflow) {
        setWorkflowSetupError(
          `پروژه ساخته شد، اما ساخت گردش‌کار انجام نشد: ${!created.ok ? (created.message ?? "خطای نامشخص") : "نتیجهٔ نامعتبر"}`,
        );
        setWorkflowSetupProjectId(result.project.id);
        return;
      }
      workflowId = created.workflow.id;
    }
    const runtimeWorkflow = workflowCatalog.getPublishedWorkflow(workflowId);
    if (!runtimeWorkflow) {
      setWorkflowSetupError(
        "پروژه ساخته شد و گردش‌کار پیش‌فرض فعال است. گردش‌کار جدید را منتشر و سپس تخصیص دهید.",
      );
      setWorkflowSetupProjectId(result.project.id);
      if (workflowChoice !== "existing")
        navigate(
          `/projects/${result.project.id}/workflow?workflowId=${encodeURIComponent(workflowId)}`,
        );
      return;
    }
    const assignment = await workflowCatalog.assignWorkflow(
      result.project.id,
      runtimeWorkflow.workflowId,
    );
    if (!assignment.ok) {
      setWorkflowSetupError(
        `پروژه ساخته شد، اما تنظیم گردش‌کار انجام نشد: ${assignment.message ?? "خطای نامشخص"}`,
      );
      setWorkflowSetupProjectId(result.project.id);
      return;
    }

    form.reset(createProjectDefaultValues);
    setWorkflowSetupError("");
    setShowCreateModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">پروژه‌ها</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filteredProjects.length} پروژه
          </p>
        </div>
        <button
          onClick={openCreateProject}
          disabled={!canCreateProject}
          title={
            canCreateProject
              ? undefined
              : createLoading
                ? displayCopy.createLoading
                : (createError ?? displayCopy.createUnavailable)
          }
          className="app-action disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          پروژه جدید
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => selectFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                isFilterActive(f.id)
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {projectView === "archived" && filter !== "all" && (
          <button
            type="button"
            onClick={() => setProjectView("all")}
            className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs text-primary"
          >
            آرشیو ×
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جستجوی پروژه..."
              className="w-48 px-9 py-2 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
          </div>
          <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-all ${viewMode === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Projects Grid */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}/overview`)}
              className="karnex-card-hover p-5 cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: project.color + "20" }}
                >
                  <FolderKanban
                    className="w-5 h-5"
                    style={{ color: project.color }}
                  />
                </div>
                <div className="flex items-center gap-1">
                  {project.privacy === "private" ? (
                    <Lock className="w-3 h-3 text-muted-foreground" />
                  ) : (
                    <Globe className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
              </div>

              <h3 className="font-semibold text-sm text-foreground mb-1 group-hover:text-primary transition-colors">
                {project.name}
              </h3>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                  {project.key}
                </span>
                <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                  {projectTypeLabels[project.type]}
                </span>
              </div>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {project.endDate}
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" />
                  {project.progress}٪
                </span>
              </div>

              <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-3">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${project.progress}%`,
                    backgroundColor: project.color,
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex -space-x-1">
                  {project.members.slice(0, 3).map((memberId, i) => {
                    const member = members.find((m) => m.id === memberId);
                    return (
                      <UserAvatar
                        key={i}
                        avatarId={member?.avatarId}
                        name={member?.name}
                        className="w-5 h-5 border border-background"
                      />
                    );
                  })}
                  {project.members.length > 3 && (
                    <span className="w-5 h-5 rounded-full bg-secondary border border-background flex items-center justify-center text-[8px] text-muted-foreground mr-[-4px]">
                      +{project.members.length - 3}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    project.status === "active"
                      ? "bg-green-500/10 text-green-400"
                      : project.status === "paused"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : "bg-gray-500/10 text-gray-400"
                  }`}
                >
                  {project.status === "active"
                    ? "فعال"
                    : project.status === "paused"
                      ? "متوقف"
                      : "آرشیو"}
                </span>
              </div>
            </div>
          ))}
          {filteredProjects.length === 0 && (
            <div className="col-span-full grid min-h-40 place-items-center rounded-xl border border-dashed border-border bg-surface-inset/45 px-4 text-center text-sm text-muted-foreground">
              {projects.length
                ? "پروژه‌ای مطابق جستجو یا فیلترهای انتخاب‌شده پیدا نشد."
                : "هنوز پروژه‌ای برای نمایش وجود ندارد."}
            </div>
          )}
        </div>
      ) : (
        <div className="karnex-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                  پروژه
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                  کلید
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                  نوع
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                  پیشرفت
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                  اعضا
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                  وضعیت
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground">
                  ددلاین
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => (
                <tr
                  key={project.id}
                  className="border-b border-border hover:bg-secondary/20 transition-colors cursor-pointer"
                  onClick={() => navigate(`/projects/${project.id}/overview`)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: project.color + "20" }}
                      >
                        <FolderKanban
                          className="w-4 h-4"
                          style={{ color: project.color }}
                        />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">
                          {project.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {project.description.slice(0, 30)}...
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {project.key}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] bg-secondary px-2 py-0.5 rounded">
                      {projectTypeLabels[project.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${project.progress}%`,
                            backgroundColor: project.color,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {project.progress}٪
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex -space-x-1">
                      {project.members.slice(0, 3).map((memberId, i) => {
                        const member = members.find((m) => m.id === memberId);
                        return (
                          <UserAvatar
                            key={i}
                            avatarId={member?.avatarId}
                            name={member?.name}
                            className="w-5 h-5 border border-background"
                          />
                        );
                      })}
                      {project.members.length > 3 && (
                        <span className="w-5 h-5 rounded-full bg-secondary border border-background flex items-center justify-center text-[8px] text-muted-foreground mr-[-4px]">
                          +{project.members.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full ${
                        project.status === "active"
                          ? "bg-green-500/10 text-green-400"
                          : project.status === "paused"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-gray-500/10 text-gray-400"
                      }`}
                    >
                      {project.status === "active"
                        ? "فعال"
                        : project.status === "paused"
                          ? "متوقف"
                          : "آرشیو"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {project.endDate}
                  </td>
                </tr>
              ))}
              {filteredProjects.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-muted-foreground"
                  >
                    {projects.length
                      ? "پروژه‌ای مطابق جستجو یا فیلترهای انتخاب‌شده پیدا نشد."
                      : "هنوز پروژه‌ای برای نمایش وجود ندارد."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-foreground">پروژه جدید</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg hover:bg-secondary transition-colors"
              >
                <Plus className="w-5 h-5 rotate-45 text-muted-foreground" />
              </button>
            </div>
            <form
              onSubmit={form.handleSubmit(
                (values) => void submitCreateProject(values),
              )}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  نام پروژه
                </label>
                <input
                  {...form.register("name")}
                  aria-label="نام پروژه"
                  disabled={!canCreateProject}
                  aria-invalid={!!form.formState.errors.name}
                  type="text"
                  placeholder="نام پروژه"
                  className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                />
                {form.formState.errors.name && (
                  <p className="mt-1 text-xs text-red-500">
                    {form.formState.errors.name.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  کلید پروژه
                </label>
                <input
                  {...form.register("key")}
                  aria-label="کلید پروژه"
                  disabled={!canCreateProject}
                  aria-invalid={!!form.formState.errors.key}
                  type="text"
                  placeholder="PRJ"
                  className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  dir="ltr"
                />
                {form.formState.errors.key && (
                  <p className="mt-1 text-xs text-red-500">
                    {form.formState.errors.key.message}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  نوع پروژه
                </label>
                <div className="flex gap-2">
                  {["scrum", "kanban", "basic"].map((type) => (
                    <button
                      type="button"
                      disabled={!canCreateProject}
                      key={type}
                      onClick={() =>
                        form.setValue(
                          "type",
                          type as CreateProjectFormValues["type"],
                        )
                      }
                      className={`flex-1 p-3 rounded-xl border text-xs transition-all disabled:cursor-not-allowed disabled:opacity-60 ${selectedProjectType === type ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground hover:border-primary/50"}`}
                    >
                      {type === "scrum"
                        ? "اسکرام"
                        : type === "kanban"
                          ? "کانبان"
                          : "پایه"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  توضیحات
                </label>
                <textarea
                  {...form.register("description")}
                  disabled={!canCreateProject}
                  placeholder="توضیحات پروژه..."
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  گردش‌کار
                </label>
                <div className="mb-3 flex gap-2">
                  {(
                    [
                      ["existing", "استفاده از موجود"],
                      ["clone", "کپی از موجود"],
                      ["create", "ساخت جدید"],
                    ] as const
                  ).map(([choice, label]) => (
                    <button
                      key={choice}
                      type="button"
                      onClick={() => {
                        setWorkflowChoice(choice);
                        setWorkflowSetupError("");
                      }}
                      className={`rounded-lg border px-3 py-2 text-xs ${workflowChoice === choice ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {workflowChoice !== "create" && (
                  <select
                    aria-label={
                      workflowChoice === "clone"
                        ? "گردش‌کار مبنای کپی"
                        : "گردش‌کار پروژه"
                    }
                    value={selectedWorkflowId}
                    disabled={
                      !canCreateProject ||
                      !workflowCatalog.capabilities.canAssignWorkflow
                    }
                    onChange={(event) => {
                      setSelectedWorkflowId(event.target.value);
                      setWorkflowSetupError("");
                    }}
                    className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {selectableWorkflows.map((workflow) => {
                      const published = workflowCatalog.getPublishedWorkflow(
                        workflow.id,
                      );
                      return (
                        <option key={workflow.id} value={workflow.id}>
                          {workflow.name} — منتشرشده ·{" "}
                          {published?.statuses.length ?? 0} وضعیت
                        </option>
                      );
                    })}
                  </select>
                )}
                {workflowChoice === "clone" && (
                  <>
                    <input
                      aria-label="نام گردش‌کار کپی‌شده"
                      value={cloneWorkflowName}
                      onChange={(event) =>
                        setCloneWorkflowName(event.target.value)
                      }
                      placeholder="نام گردش‌کار کپی‌شده"
                      className="mt-3 w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm"
                    />
                    <textarea
                      aria-label="توضیحات گردش‌کار کپی‌شده"
                      value={cloneWorkflowDescription}
                      onChange={(event) =>
                        setCloneWorkflowDescription(event.target.value)
                      }
                      placeholder="توضیحات (اختیاری)"
                      rows={2}
                      className="mt-2 w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm resize-none"
                    />
                  </>
                )}
                {workflowChoice === "create" && (
                  <>
                    <input
                      aria-label="نام گردش‌کار جدید پروژه"
                      value={newWorkflowName}
                      onChange={(event) =>
                        setNewWorkflowName(event.target.value)
                      }
                      placeholder="نام گردش‌کار جدید"
                      className="mt-3 w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm"
                    />
                    <textarea
                      aria-label="توضیحات گردش‌کار جدید پروژه"
                      value={newWorkflowDescription}
                      onChange={(event) =>
                        setNewWorkflowDescription(event.target.value)
                      }
                      placeholder="توضیحات (اختیاری)"
                      rows={2}
                      className="mt-2 w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground text-sm resize-none"
                    />
                  </>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  گردش‌کار انتخاب‌شده فقط پس از ساخت پروژه و تأیید قرارداد
                  catalog تخصیص داده می‌شود.
                </p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-foreground hover:bg-secondary transition-all text-sm"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={!canSubmitProject}
                  title={
                    canCreateProject
                      ? undefined
                      : createLoading
                        ? displayCopy.createLoading
                        : (createError ?? displayCopy.createUnavailable)
                  }
                  className="app-action flex-1 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ساخت پروژه
                </button>
              </div>
              {!canCreateProject && (
                <p className="text-xs text-muted-foreground">
                  {createLoading
                    ? displayCopy.createLoading
                    : (createError ?? displayCopy.createUnavailable)}
                </p>
              )}
              {workflowSetupError && (
                <div
                  role="alert"
                  className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
                >
                  <p>{workflowSetupError}</p>
                  {workflowSetupProjectId && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/projects/${workflowSetupProjectId}/settings`)
                      }
                      className="mt-2 underline"
                    >
                      رفتن به تنظیمات گردش‌کار پروژه
                    </button>
                  )}
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
