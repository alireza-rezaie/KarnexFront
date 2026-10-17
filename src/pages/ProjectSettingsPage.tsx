import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ChevronLeft, Save, Trash2, AlertTriangle, UserPlus, UserMinus } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { useProjects } from "@/contexts/ProjectsContext";
import { AuthContext } from "@/contexts/AuthContext";
import { useWorkflowCatalog } from "@/contexts/WorkflowCatalogContext";
import { MembersContext } from "@/contexts/MembersContext";
import { RolesContext } from "@/contexts/RolesContext";
import { isProjectRoleManager, projectRoleIds, projectRoleLabels } from "@/types/role";
import { getProjectMemberRole } from "@/types/project";
import { UserAvatar } from "@/components/UserAvatar";

const settingTabs = [
  { id: "general", label: "عمومی" },
  { id: "types", label: "Issue Types" },
  { id: "workflow", label: "گردش‌کار" },
  { id: "versions", label: "Versions" },
  { id: "access", label: "دسترسی" },
];
const noRoleValue = "__no-project-role__";
const systemRoleIds = [projectRoleIds.projectManager, projectRoleIds.scrumMaster] as const;

const projectSettingsSchema = (
  existingKeys: { id: string; key: string }[],
  currentProjectId: string | undefined,
) =>
  z.object({
    name: z.string().trim().min(1, "نام پروژه الزامی است"),
    key: z
      .string()
      .trim()
      .min(1, "کلید پروژه الزامی است")
      .refine(
        (value) =>
          !existingKeys.some(
            (project) =>
              project.id !== currentProjectId &&
              project.key.toLocaleLowerCase("en-US") ===
                value.toLocaleLowerCase("en-US"),
          ),
        "کلید پروژه تکراری است",
      ),
    description: z.string(),
  });

type ProjectSettingsFormValues = z.infer<
  ReturnType<typeof projectSettingsSchema>
>;

export default function ProjectSettingsPage() {
  const navigate = useNavigate();
  const { currentProject } = useProject();
  const {
    projects,
    projectVersions,
    versionServiceAvailable,
    versionLoading,
    versionError,
    versionCapabilities,
    settingsServiceAvailable,
    settingsLoading,
    settingsError,
    settingsCapabilities,
    updateProject,
    deleteServiceAvailable,
    deleteLoading,
    deleteError,
    deleteCapabilities,
    deleteProject,
    accessCapabilities,
    canManageProjectAccess,
    addProjectMember,
    updateProjectMemberAccess,
    removeProjectMember,
  } = useProjects();
  const auth = useContext(AuthContext);
  const members = useContext(MembersContext)?.members ?? [];
  const roles = useContext(RolesContext)?.roles ?? [];
  const workflowCatalog = useWorkflowCatalog();
  const projectPath = `/projects/${currentProject?.id ?? ""}`;
  const versions = currentProject
    ? projectVersions.filter(
        (version) => version.projectId === currentProject.id,
      )
    : [];
  const [activeTab, setActiveTab] = useState("general");
  const [workflowSelection, setWorkflowSelection] = useState<{
    projectId?: string;
    workflowId: string;
  }>({ workflowId: "" });
  const [workflowAssignmentError, setWorkflowAssignmentError] = useState("");
  const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
  const [cloneSourceId, setCloneSourceId] = useState("");
  const [cloneName, setCloneName] = useState("");
  const [cloneDescription, setCloneDescription] = useState("");
  const [cloneError, setCloneError] = useState("");
  const [cloneSubmitting, setCloneSubmitting] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [accessMemberId, setAccessMemberId] = useState("");
  const [accessRoleId, setAccessRoleId] = useState(noRoleValue);
  const [accessError, setAccessError] = useState("");
  const form = useForm<ProjectSettingsFormValues>({
    resolver: zodResolver(projectSettingsSchema(projects, currentProject?.id)),
    defaultValues: {
      name: currentProject?.name ?? "",
      key: currentProject?.key ?? "",
      description: currentProject?.description ?? "",
    },
  });

  useEffect(() => {
    if (!currentProject) return;

    form.reset({
      name: currentProject.name,
      key: currentProject.key,
      description: currentProject.description,
    });
  }, [currentProject, form]);

  const activeWorkflow = currentProject
    ? workflowCatalog.getActiveWorkflow(currentProject.id)
    : undefined;
  const activeWorkflowDefinition = activeWorkflow
    ? workflowCatalog.getWorkflow(activeWorkflow.workflowId)
    : undefined;
  const selectableWorkflows = workflowCatalog.workflows.filter((workflow) =>
    Boolean(workflowCatalog.getPublishedWorkflow(workflow.id)),
  );
  const selectedWorkflowId =
    workflowSelection.projectId === currentProject?.id &&
    workflowSelection.workflowId
      ? workflowSelection.workflowId
      : (activeWorkflow?.workflowId ?? "");
  const canManageProjectSettings = Boolean(
    currentProject &&
    auth?.currentUserId &&
    isProjectRoleManager(currentProject.memberRoles?.[auth.currentUserId]),
  );

  const canUpdateProject = Boolean(
    currentProject &&
    canManageProjectSettings &&
    settingsServiceAvailable &&
    !settingsLoading &&
    settingsCapabilities.canUpdateProject &&
    updateProject,
  );
  const submitProjectSettings = async (values: ProjectSettingsFormValues) => {
    if (!currentProject || !updateProject || !canUpdateProject) return;
    await updateProject(currentProject.id, values);
  };
  const canDeleteProject = Boolean(
    currentProject &&
    canManageProjectSettings &&
    deleteServiceAvailable &&
    !deleteLoading &&
    deleteCapabilities.canDeleteProject &&
    deleteProject,
  );
  const canManageAccess = Boolean(
    currentProject &&
    accessCapabilities.canManageProjectAccess &&
    canManageProjectAccess(currentProject.id),
  );
  const projectMembers = currentProject
    ? currentProject.members
      .map((memberId) => members.find((member) => member.id === memberId))
      .filter((member): member is NonNullable<typeof member> => Boolean(member))
      .map((member) => ({ ...member, roleId: getProjectMemberRole(currentProject, member.id, member.roleId) }))
    : [];
  const availableMembers = currentProject
    ? members.filter((member) => !currentProject.members.includes(member.id))
    : [];
  const roleOptions = [
    ...systemRoleIds.map((id) => ({ id, name: projectRoleLabels[id] })),
    ...roles.filter((role) => !systemRoleIds.includes(role.id as typeof systemRoleIds[number])),
  ];
  const roleLabel = (roleId: string | undefined) => roleOptions.find((role) => role.id === roleId)?.name ?? "بدون نقش دسترسی";
  const submitAddProjectMember = async () => {
    if (!currentProject || !accessMemberId || !addProjectMember) return;
    setAccessError("");
    const result = await addProjectMember(currentProject.id, { memberId: accessMemberId, ...(accessRoleId === noRoleValue ? {} : { roleId: accessRoleId }) });
    if (!result.ok) return setAccessError(result.message ?? "افزودن عضو انجام نشد.");
    setAccessMemberId("");
    setAccessRoleId(noRoleValue);
  };
  const changeProjectMemberRole = async (memberId: string, roleId: string) => {
    if (!currentProject || !updateProjectMemberAccess) return;
    setAccessError("");
    const result = await updateProjectMemberAccess(currentProject.id, { memberId, ...(roleId === noRoleValue ? {} : { roleId }) });
    if (!result.ok) setAccessError(result.message ?? "تغییر دسترسی انجام نشد.");
  };
  const removeAccess = async (memberId: string) => {
    if (!currentProject || !removeProjectMember) return;
    setAccessError("");
    const result = await removeProjectMember(currentProject.id, memberId);
    if (!result.ok) setAccessError(result.message ?? "حذف دسترسی انجام نشد.");
  };
  const submitProjectDelete = async () => {
    if (!currentProject || !deleteProject || !canDeleteProject) return;
    if (
      !window.confirm(`آیا از حذف پروژه «${currentProject.name}» مطمئن هستید؟`)
    )
      return;
    const result = await deleteProject(currentProject.id);
    if (result.ok) navigate("/projects", { replace: true });
  };
  const canAssignWorkflow = Boolean(
    currentProject &&
    canManageProjectSettings &&
    !workflowCatalog.loading &&
    canManageAccess &&
    workflowCatalog.capabilities.canAssignWorkflow,
  );
  const reusableWorkflows = workflowCatalog.workflows.filter((workflow) =>
    Boolean(workflowCatalog.getPublishedWorkflow(workflow.id)),
  );
  const openCloneDialog = () => {
    const sourceId =
      activeWorkflow?.workflowId ?? reusableWorkflows[0]?.id ?? "";
    setCloneSourceId(sourceId);
    setCloneName("");
    setCloneDescription("");
    setCloneError("");
    setCloneDialogOpen(true);
  };
  const submitCloneWorkflow = async () => {
    if (!currentProject || !cloneSourceId || !cloneName.trim()) {
      setCloneError("انتخاب گردش‌کار و نام جدید الزامی است.");
      return;
    }
    setCloneSubmitting(true);
    setCloneError("");
    const result = await workflowCatalog.cloneWorkflow(cloneSourceId, {
      name: cloneName,
      ownerProjectId: currentProject.id,
      ...(cloneDescription.trim() ? { description: cloneDescription } : {}),
    });
    setCloneSubmitting(false);
    if (!result.ok) {
      setCloneError(result.message ?? "کپی‌برداری از گردش‌کار انجام نشد.");
      return;
    }
    if (!result.workflow) {
      setCloneError("کپی‌برداری از گردش‌کار انجام نشد.");
      return;
    }
    setCloneDialogOpen(false);
    navigate(
      `${projectPath}/workflow?workflowId=${encodeURIComponent(result.workflow.id)}`,
    );
  };
  const openCreateDialog = () => {
    setCreateName("");
    setCreateDescription("");
    setCreateError("");
    setCreateDialogOpen(true);
  };
  const submitCreateWorkflow = async () => {
    if (!currentProject || !createName.trim()) {
      setCreateError("نام گردش‌کار الزامی است.");
      return;
    }
    setCreateSubmitting(true);
    setCreateError("");
    const result = await workflowCatalog.createWorkflowDraft({
      name: createName,
      ownerProjectId: currentProject.id,
      ...(createDescription.trim() ? { description: createDescription } : {}),
    });
    setCreateSubmitting(false);
    if (!result.ok) {
      setCreateError(result.message ?? "ساخت گردش‌کار انجام نشد.");
      return;
    }
    if (!result.workflow) {
      setCreateError("ساخت گردش‌کار انجام نشد.");
      return;
    }
    setCreateDialogOpen(false);
    navigate(
      `${projectPath}/workflow?workflowId=${encodeURIComponent(result.workflow.id)}`,
    );
  };
  const submitWorkflowAssignment = async () => {
    if (
      !currentProject ||
      !canAssignWorkflow ||
      !selectedWorkflowId ||
      selectedWorkflowId === activeWorkflow?.workflowId
    )
      return;
    const selected = workflowCatalog.getPublishedWorkflow(selectedWorkflowId);
    if (!selected)
      return setWorkflowAssignmentError(
        "گردش‌کار انتخاب‌شده نسخهٔ منتشرشده ندارد.",
      );
    if (
      !window.confirm(
        `گردش‌کار پروژه به «${workflowCatalog.getWorkflow(selectedWorkflowId)?.name ?? "انتخاب‌شده"}» تغییر کند؟ وضعیت وظایف به‌صورت خودکار جابه‌جا نمی‌شود.`,
      )
    )
      return;
    setWorkflowAssignmentError("");
    const result = await workflowCatalog.assignWorkflow(
      currentProject.id,
      selectedWorkflowId,
    );
    if (!result.ok)
      setWorkflowAssignmentError(
        result.message ?? "تغییر گردش‌کار پروژه انجام نشد.",
      );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <button
          onClick={() => navigate(`${projectPath}/overview`)}
          className="hover:text-foreground"
        >
          نمای کلی پروژه
        </button>
        <ChevronLeft className="w-3 h-3" />
        <span className="text-foreground">تنظیمات پروژه</span>
      </div>

      <h1 className="text-xl font-bold text-foreground">تنظیمات پروژه</h1>

      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 w-fit">
        {settingTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() =>
              setActiveTab(tab.id)
            }
            className={`px-4 py-2 rounded-lg text-xs transition-all ${activeTab === tab.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="karnex-card w-full p-4 sm:p-6">
        {activeTab === "general" && (
          <>
            <form
              onSubmit={form.handleSubmit(
                (values) => void submitProjectSettings(values),
              )}
              className="space-y-4"
            >
              <h2 className="text-lg font-bold text-foreground">
                اطلاعات عمومی
              </h2>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  نام پروژه
                </label>
                <input
                  {...form.register("name")}
                  disabled={!canUpdateProject}
                  aria-invalid={!!form.formState.errors.name}
                  type="text"
                  className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm disabled:cursor-not-allowed disabled:opacity-60"
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
                  disabled={!canUpdateProject}
                  aria-invalid={!!form.formState.errors.key}
                  type="text"
                  className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm disabled:cursor-not-allowed disabled:opacity-60"
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
                  توضیحات
                </label>
                <textarea
                  {...form.register("description")}
                  disabled={!canUpdateProject}
                  aria-invalid={!!form.formState.errors.description}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl bg-secondary border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none disabled:cursor-not-allowed disabled:opacity-60"
                />
                {form.formState.errors.description && (
                  <p className="mt-1 text-xs text-red-500">
                    {form.formState.errors.description.message}
                  </p>
                )}
              </div>
              {canUpdateProject && (
                <button type="submit" className="app-action">
                  <Save className="w-4 h-4" />
                  ذخیره
                </button>
              )}
              {settingsError && (
                <p className="text-xs text-destructive">{settingsError}</p>
              )}
              {!canUpdateProject && !settingsError && (
                <p className="text-xs text-muted-foreground">
                  {settingsLoading
                    ? "در حال دریافت تنظیمات پروژه…"
                    : "تنظیمات پروژه فقط برای مدیر پروژه یا اسکرام‌مسترِ عضو پروژه قابل ویرایش است."}
                </p>
              )}

              <div className="pt-6 mt-6 border-t border-border">
                <div className="flex items-center gap-3 mb-4">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  <h3 className="text-sm font-medium text-destructive">
                    {" "}
                    zone خطر
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">حذف پروژه غیرقابل بازگشت است.</p>
                {canDeleteProject && (
                  <button
                    type="button"
                    onClick={() => void submitProjectDelete()}
                    className="flex items-center gap-2 rounded-xl border border-destructive px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="w-4 h-4" />
                    حذف پروژه
                  </button>
                )}
                {deleteError && (
                  <p className="mt-2 text-xs text-destructive">{deleteError}</p>
                )}
                {!canDeleteProject && !deleteError && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {deleteLoading
                      ? "در حال حذف پروژه…"
                      : "فقط مدیر پروژه یا اسکرام‌مسترِ عضو پروژه می‌تواند آن را حذف کند."}
                  </p>
                )}
              </div>
            </form>
          </>
        )}

        {activeTab === "workflow" && (
          <>
            <section
              aria-labelledby="project-workflow-assignment-title"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2
                    id="project-workflow-assignment-title"
                    className="text-lg font-bold text-foreground"
                  >
                    گردش‌کار پروژه
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    گردش‌کار منتشرشدهٔ فعال، وضعیت‌ها و انتقال‌های برد این پروژه
                    را تعیین می‌کند.
                  </p>
                </div>
                {canManageProjectSettings && (
                  <button
                    type="button"
                    onClick={() => navigate(`${projectPath}/workflow`)}
                    className="rounded-xl border border-border px-3 py-2 text-xs text-primary hover:border-primary/30 hover:bg-primary/5"
                  >
                    ویرایش گردش‌کار
                  </button>
                )}
              </div>
              <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-3">
                <p className="text-[10px] text-muted-foreground">
                  گردش‌کار فعال
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {activeWorkflow
                    ? (activeWorkflowDefinition?.name ?? "گردش‌کار منتشرشده")
                    : "گردش‌کار منتشرشده یافت نشد"}
                </p>
                {activeWorkflow && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {activeWorkflowDefinition?.isSystem ? "سیستمی / Built-in" : "سفارشی"} · منتشرشده · {activeWorkflow.statuses.length} وضعیت · نسخهٔ{" "}
                    {activeWorkflow.version}
                  </p>
                )}
              </div>
              <div className="mt-4" aria-label="کتابخانه گردش‌کار">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-foreground">کتابخانهٔ گردش‌کار</h3>
                  <span className="text-[11px] text-muted-foreground">فقط نسخه‌های منتشرشده قابل انتساب‌اند</span>
                </div>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {workflowCatalog.workflows.map((workflow) => {
                    const published = workflowCatalog.getPublishedWorkflow(workflow.id);
                    const active = workflow.id === activeWorkflow?.workflowId;
                    return (
                      <div key={workflow.id} className={`rounded-xl border p-3 ${active ? "border-primary bg-primary/5" : "border-border bg-secondary/20"}`}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{workflow.name}</p>
                          {active && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">فعال</span>}
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {workflow.isSystem ? "سیستمی / Built-in" : "سفارشی"} · {published ? `منتشرشده (نسخه ${published.version})` : "پیش‌نویس"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
              <label className="mt-4 block text-xs font-medium text-foreground">
                انتخاب گردش‌کار منتشرشده
                <select
                  aria-label="انتخاب گردش‌کار منتشرشده"
                  value={selectedWorkflowId}
                  disabled={!canAssignWorkflow}
                  onChange={(event) => {
                    setWorkflowSelection({
                      projectId: currentProject?.id,
                      workflowId: event.target.value,
                    });
                    setWorkflowAssignmentError("");
                  }}
                  className="mt-2 w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {selectableWorkflows.map((workflow) => {
                    const published = workflowCatalog.getPublishedWorkflow(
                      workflow.id,
                    );
                    return (
                      <option key={workflow.id} value={workflow.id}>
                        {workflow.name} {workflow.isSystem ? "— سیستمی / Built-in" : "— سفارشی"}
                        {published
                          ? ` — منتشرشده (نسخه ${published.version})`
                          : " — منتشرنشده"}
                      </option>
                    );
                  })}
                </select>
              </label>
              {canManageProjectSettings ? <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={
                    !canAssignWorkflow ||
                    selectedWorkflowId === activeWorkflow?.workflowId
                  }
                  onClick={() => void submitWorkflowAssignment()}
                  className="app-action disabled:cursor-not-allowed disabled:opacity-50"
                >
                  تغییر گردش‌کار
                </button>
                <button
                  type="button"
                  disabled={!workflowCatalog.capabilities.canCreateWorkflow}
                  onClick={openCreateDialog}
                  className="rounded-xl border border-border px-3 py-2 text-xs text-primary hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ساخت گردش‌کار جدید
                </button>
                <button
                  type="button"
                  disabled={
                    !workflowCatalog.capabilities.canCloneWorkflow ||
                    !reusableWorkflows.length
                  }
                  onClick={openCloneDialog}
                  className="rounded-xl border border-border px-3 py-2 text-xs text-primary hover:border-primary/30 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  کپی گردش‌کار
                </button>
                <span className="text-[11px] text-muted-foreground">
                  تغییر فقط پس از تأیید ثبت می‌شود؛ وضعیت وظایف خودکار migrate
                  نمی‌شود.
                </span>
              </div> : (
                <p className="mt-3 text-xs text-muted-foreground">تنظیم گردش‌کار فقط برای مدیر پروژه یا اسکرام‌مسترِ عضو پروژه قابل ویرایش است.</p>
              )}
              {workflowAssignmentError && (
                <p role="alert" className="mt-3 text-xs text-destructive">
                  {workflowAssignmentError}
                </p>
              )}
              {workflowCatalog.error && (
                <p role="alert" className="mt-3 text-xs text-destructive">
                  {workflowCatalog.error}
                </p>
              )}
            </section>
            {cloneDialogOpen && (
              <div
                className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="clone-workflow-title"
              >
                <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
                  <h2
                    id="clone-workflow-title"
                    className="text-lg font-bold text-foreground"
                  >
                    کپی گردش‌کار
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    کپی مستقل ساخته می‌شود و گردش‌کار فعال پروژه را تغییر
                    نمی‌دهد.
                  </p>
                  <label className="mt-4 block text-xs font-medium text-foreground">
                    گردش‌کار مبنا
                    <select
                      aria-label="گردش‌کار مبنا"
                      value={cloneSourceId}
                      onChange={(event) => {
                        setCloneSourceId(event.target.value);
                        setCloneError("");
                      }}
                      className="mt-2 w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground"
                    >
                      {reusableWorkflows.map((workflow) => {
                        const published = workflowCatalog.getPublishedWorkflow(
                          workflow.id,
                        );
                        return (
                          <option key={workflow.id} value={workflow.id}>
                            {workflow.name} —{" "}
                            {published ? "منتشرشده" : "منتشرنشده"} ·{" "}
                            {published?.statuses.length ?? 0} وضعیت
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <label className="mt-4 block text-xs font-medium text-foreground">
                    نام گردش‌کار جدید
                    <input
                      aria-label="نام گردش‌کار جدید"
                      value={cloneName}
                      onChange={(event) => {
                        setCloneName(event.target.value);
                        setCloneError("");
                      }}
                      className="mt-2 w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground"
                      autoFocus
                    />
                  </label>
                  <label className="mt-4 block text-xs font-medium text-foreground">
                    توضیحات (اختیاری)
                    <textarea
                      aria-label="توضیحات گردش‌کار جدید"
                      value={cloneDescription}
                      onChange={(event) =>
                        setCloneDescription(event.target.value)
                      }
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground"
                    />
                  </label>
                  {cloneError && (
                    <p role="alert" className="mt-3 text-xs text-destructive">
                      {cloneError}
                    </p>
                  )}
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCloneDialogOpen(false)}
                      className="rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-secondary"
                    >
                      انصراف
                    </button>
                    <button
                      type="button"
                      disabled={cloneSubmitting}
                      onClick={() => void submitCloneWorkflow()}
                      className="app-action disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {cloneSubmitting ? "در حال کپی…" : "ساخت کپی"}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {createDialogOpen && (
              <div
                className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4"
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-workflow-title"
              >
                <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
                  <h2
                    id="create-workflow-title"
                    className="text-lg font-bold text-foreground"
                  >
                    ساخت گردش‌کار جدید
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    گردش‌کار مستقل ساخته می‌شود و گردش‌کار فعال پروژه را تغییر
                    نمی‌دهد.
                  </p>
                  <label className="mt-4 block text-xs font-medium text-foreground">
                    نام گردش‌کار
                    <input
                      aria-label="نام گردش‌کار"
                      value={createName}
                      onChange={(event) => {
                        setCreateName(event.target.value);
                        setCreateError("");
                      }}
                      className="mt-2 w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground"
                      autoFocus
                    />
                  </label>
                  <label className="mt-4 block text-xs font-medium text-foreground">
                    توضیحات (اختیاری)
                    <textarea
                      aria-label="توضیحات گردش‌کار"
                      value={createDescription}
                      onChange={(event) =>
                        setCreateDescription(event.target.value)
                      }
                      rows={3}
                      className="mt-2 w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-foreground"
                    />
                  </label>
                  {createError && (
                    <p role="alert" className="mt-3 text-xs text-destructive">
                      {createError}
                    </p>
                  )}
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateDialogOpen(false)}
                      className="rounded-xl px-3 py-2 text-xs text-muted-foreground hover:bg-secondary"
                    >
                      انصراف
                    </button>
                    <button
                      type="button"
                      disabled={createSubmitting}
                      onClick={() => void submitCreateWorkflow()}
                      className="app-action disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {createSubmitting ? "در حال ساخت…" : "ساخت گردش‌کار"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "types" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">انواع Issue</h2>
            {[
              {
                name: "Epic",
                color: "#8b5cf6",
                desc: "ویژگی بزرگ و چندمرحله‌ای",
              },
              {
                name: "Story",
                color: "#22c55e",
                desc: "نیازمندی از دید کاربر",
              },
              { name: "Task", color: "#3b82f6", desc: "وظیفه کلی" },
              { name: "Bug", color: "#ef4444", desc: "خطا و مشکل" },
              { name: "Sub-task", color: "#6b7280", desc: "زیروظیفه" },
            ].map((type, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: type.color }}
                  />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {type.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{type.desc}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  پیکربندی ثابت
                </span>
              </div>
            ))}
          </div>
        )}

        {activeTab === "versions" && (
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-foreground">Versions</h2>
            {versions.map((version) => (
              <div
                key={version.id}
                className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {version.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {version.releaseDate ?? "—"}
                  </p>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full ${
                    version.status === "released"
                      ? "bg-green-500/10 text-green-400"
                      : version.status === "in_progress"
                        ? "bg-blue-500/10 text-blue-400"
                        : "bg-yellow-500/10 text-yellow-400"
                  }`}
                >
                  {version.status === "released"
                    ? "منتشرشده"
                    : version.status === "in_progress"
                      ? "در حال توسعه"
                      : "برنامه‌ریزی"}
                </span>
              </div>
            ))}
            {!versions.length && (
              <p className="text-sm text-muted-foreground">
                {versionLoading
                  ? "در حال دریافت نسخه‌ها…"
                  : (versionError ??
                    (versionServiceAvailable &&
                    versionCapabilities.canViewProjectVersions
                      ? "نسخه‌ای برای این پروژه ثبت نشده است."
                      : "نسخه‌ها پس از اتصال API نمایش داده می‌شوند."))}
              </p>
            )}
          </div>
        )}

        {activeTab === "access" && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-foreground">دسترسی اعضا</h2>
                <p className="mt-1 text-sm text-muted-foreground">اعضای فعلی پروژه و نقش دسترسی آن‌ها</p>
              </div>
              {!canManageAccess && <p className="text-xs text-muted-foreground">فقط مدیر پروژه یا اسکرام‌مسترِ عضو پروژه می‌تواند دسترسی‌ها را تغییر دهد.</p>}
            </div>

            {canManageAccess && <div className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-secondary/30 p-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
              <label className="text-xs font-medium text-foreground">کاربر موجود در فهرست اعضا
                <select aria-label="افزودن عضو به پروژه" value={accessMemberId} onChange={(event) => setAccessMemberId(event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                  <option value="">انتخاب عضو</option>
                  {availableMembers.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
              </label>
              <label className="text-xs font-medium text-foreground">نقش دسترسی
                <select aria-label="نقش عضو جدید" value={accessRoleId} onChange={(event) => setAccessRoleId(event.target.value)} className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                  <option value={noRoleValue}>بدون نقش دسترسی</option>
                  {roleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
              </label>
              <button type="button" onClick={() => void submitAddProjectMember()} disabled={!accessMemberId} className="app-action self-end disabled:cursor-not-allowed disabled:opacity-50"><UserPlus className="w-4 h-4" /> افزودن عضو</button>
            </div>}

            <div className="rounded-xl border border-border">
              <div className="divide-y divide-border">
                {projectMembers.map((member) => <div key={member.id} className="flex flex-wrap items-center gap-3 p-3 sm:flex-nowrap">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <UserAvatar avatarId={member.avatarId} name={member.name} className="size-9 shrink-0" />
                    <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{member.name}</p><p className="truncate text-xs text-muted-foreground" dir="ltr">{member.email}</p></div>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
                    <select aria-label={`نقش ${member.name}`} value={member.roleId ?? noRoleValue} disabled={!canManageAccess} onChange={(event) => void changeProjectMemberRole(member.id, event.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground disabled:cursor-not-allowed disabled:opacity-60 sm:w-44">
                      <option value={noRoleValue}>بدون نقش دسترسی</option>
                      {roleOptions.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                    </select>
                    <span className="min-w-0 flex-1 text-xs text-muted-foreground sm:w-32 sm:flex-none">{roleLabel(member.roleId)}</span>
                    <button type="button" aria-label={`حذف دسترسی ${member.name}`} onClick={() => void removeAccess(member.id)} disabled={!canManageAccess} className="shrink-0 rounded-lg p-2 text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"><UserMinus className="w-4 h-4" /></button>
                  </div>
                </div>)}
                {!projectMembers.length && <p className="p-6 text-center text-sm text-muted-foreground">عضوی به این پروژه دسترسی ندارد.</p>}
              </div>
            </div>
            {accessError && <p role="alert" className="text-sm text-destructive">{accessError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
