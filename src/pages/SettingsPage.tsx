import { useMemo, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  CalendarDays,
  Check,
  ChevronLeft,
  CreditCard,
  Download,
  FolderKanban,
  Globe2,
  KeyRound,
  Languages,
  Laptop,
  Lock,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  User,
  UserPlus,
  Users,
  UsersRound,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCurrentUser } from "@/contexts/CurrentUserContext";
import { useMembers } from "@/contexts/MembersContext";
import { initialOrganization, useOrganization } from "@/contexts/OrganizationContext";
import { usePlans } from "@/contexts/PlansContext";
import { useBilling } from "@/contexts/BillingContext";
import { useTeams } from "@/contexts/TeamsContext";
import { useNotifications } from "@/contexts/NotificationsContext";
import { useSecurity } from "@/contexts/SecurityContext";
import { avatarLibrary } from "@/config/avatarLibrary";
import { UserAvatar } from "@/components/UserAvatar";
import "./SettingsPage.css";

type TabId =
  "profile" | "org" | "team" | "security" | "billing" | "notifications";
const tabs = [
  { id: "profile", label: "پروفایل", icon: User },
  { id: "org", label: "سازمان", icon: Building2 },
  { id: "team", label: "تیم‌ها", icon: Users },
  { id: "security", label: "امنیت", icon: Lock },
  { id: "billing", label: "اشتراک", icon: CreditCard },
  { id: "notifications", label: "اعلان‌ها", icon: Bell },
] as const;

const organizationFormSchema = z.object({
  name: z.string().trim().min(1, "نام سازمان الزامی است"),
  display: z.string().trim().min(1, "نام نمایشی الزامی است"),
  slug: z.string().trim().min(1, "Slug سازمان الزامی است"),
  site: z.string().trim().refine((value) => {
    if (!value) return true;

    return z.string().url().safeParse(value).success;
  }, "آدرس وب‌سایت معتبر نیست"),
  email: z.string().trim().refine((value) => {
    if (!value) return true;

    return z.string().email().safeParse(value).success;
  }, "ایمیل سازمانی معتبر نیست"),
  phone: z.string(),
  timezone: z.string(),
  address: z.string(),
  desc: z.string(),
  logo: z.string().nullable(),
});

type OrganizationFormValues = z.infer<typeof organizationFormSchema>;

function NeutralButton({
  children,
  onClick,
  type = "button",
  danger = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`settings-button${danger ? " danger" : ""}${disabled ? " cursor-not-allowed opacity-50" : ""}`}
    >
      {children}
    </button>
  );
}
function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`settings-panel ${className}`}>{children}</section>
  );
}
function Field({
  label,
  value,
  onChange,
  dir,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  dir?: "ltr" | "rtl";
  help?: string;
}) {
  return (
    <label className="settings-field">
      <span>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        dir={dir}
      />
      {help && <small>{help}</small>}
    </label>
  );
}
function SettingRow({
  icon,
  title,
  text,
  checked,
  onCheckedChange,
  disabled,
  className = "",
}: {
  icon: ReactNode;
  title: string;
  text: string;
  checked: boolean;
  onCheckedChange?: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={`setting-row ${className}`}>
      <div className="setting-copy">
        <i>{icon}</i>
        <div>
          <strong>{title}</strong>
          <span>{text}</span>
        </div>
      </div>
      <span className="setting-switch">
        <Switch
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
        />
      </span>
    </div>
  );
}
function ImagePicker({
  value,
  onChange,
  label,
}: {
  value: string | null;
  onChange: (file: File | null) => void;
  label: string;
}) {
  return (
    <div className="image-picker">
      <div>
        <strong>{label}</strong>
        <span>PNG یا JPG، حداکثر ۲ مگابایت</span>
        <label className="settings-button">
          <Upload />
          انتخاب تصویر
          <input
            type="file"
            accept="image/png,image/jpeg"
            hidden
            onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>
      {value && (
        <div className="image-preview">
          <img src={value} alt="" />
          <button onClick={() => onChange(null)} aria-label="حذف تصویر">
            <Trash2 />
          </button>
        </div>
      )}
    </div>
  );
}

function ProfilePage({ notify }: { notify: (v: string) => void }) {
  const { currentMember, updateCurrentMember } = useCurrentUser();
  const initial = useMemo(
    () => {
      const [first = "", ...rest] = (currentMember?.name ?? "").split(" ");

      return {
        first,
        last: rest.join(" "),
        email: currentMember?.email ?? "",
        phone: "",
        role: "",
        timezone: "",
        language: "",
        bio: "",
      };
    },
    [currentMember?.email, currentMember?.name],
  );
  const [form, setForm] = useState(initial);
  const [draftAvatarId, setDraftAvatarId] = useState<string | null>(currentMember?.avatarId ?? null);
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const initials = (currentMember?.name ?? "?").trim().slice(0, 2);
  const update = (key: keyof typeof initial) => (value: string) =>
    setForm((v) => ({ ...v, [key]: value }));
  async function saveProfile() {
    const name = `${form.first} ${form.last}`.trim();
    const email = form.email.trim();
    const nextErrors: { name?: string; email?: string } = {};

    if (!name) nextErrors.name = "نام الزامی است";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      nextErrors.email = "ایمیل معتبر نیست";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const updated = await updateCurrentMember({ name, email, avatarId: draftAvatarId });
    if (!updated.ok) {
      setErrors({ email: updated.message ?? "امکان ذخیره این ایمیل وجود ندارد؛ ممکن است قبلاً استفاده شده باشد" });
      return;
    }

    const [first = "", ...rest] = name.split(/\s+/);
    setForm((current) => ({ ...current, first, last: rest.join(" "), email }));
    setErrors({});
    notify("تغییرات پروفایل ذخیره شد");
  }
  function resetProfile() {
    setForm(initial);
    setDraftAvatarId(currentMember?.avatarId ?? null);
    setErrors({});
  }
  return (
    <div className="settings-view">
      <Panel className="profile-hero">
        <div className="hero-avatar">
          <UserAvatar avatarId={draftAvatarId} name={currentMember?.name ?? initials} />
          <i>
            <Pencil />
          </i>
        </div>
        <div className="hero-title">
          <h1>{currentMember?.name ?? "کاربر"}</h1>
          <b>مدیریت حساب و سازمان</b>
          <p>مدیریت کل حساب و تنظیمات سازمان</p>
        </div>
        <span className="status-badge">فعال</span>
        <div className="hero-facts">
          <span>
            <Phone />
            {form.phone || "—"}<small>موبایل</small>
          </span>
          <span>
            <Mail />
            {currentMember?.email ?? ""}<small>ایمیل</small>
          </span>
          <span>
            <Languages />
            فارسی<small>زبان</small>
          </span>
          <span>
            <Globe2 />
            Asia/Tehran<small>منطقه زمانی</small>
          </span>
        </div>
      </Panel>
      <Panel className="form-panel">
        <header>
          <h2>اطلاعات پروفایل</h2>
          <p>اطلاعات فردی و پیش‌فرض‌های خود را مدیریت کنید.</p>
        </header>
        <div className="form-grid">
          <Field label="نام" value={form.first} onChange={update("first")} help={errors.name} />
          <Field
            label="نام خانوادگی"
            value={form.last}
            onChange={update("last")}
          />
          <Field
            label="ایمیل"
            value={form.email}
            onChange={update("email")}
            dir="ltr"
            help={errors.email}
          />
          <Field
            label="موبایل"
            value={form.phone}
            onChange={update("phone")}
            dir="ltr"
          />
          <Field
            label="سمت / نقش"
            value={form.role}
            onChange={update("role")}
          />
          <Field
            label="منطقه زمانی"
            value={form.timezone}
            onChange={update("timezone")}
          />
          <Field
            label="زبان"
            value={form.language}
            onChange={update("language")}
          />
          <label className="settings-field">
            <span>بیوگرافی کوتاه</span>
            <textarea
              value={form.bio}
              onChange={(e) => update("bio")(e.target.value)}
              maxLength={200}
            />
            <small>{form.bio.length.toLocaleString("fa-IR")} / ۲۰۰</small>
          </label>
        </div>
        <section className="avatar-picker" aria-label="انتخاب آواتار">
          <div><strong>آواتار</strong><span>یک تصویر داخلی برای پروفایل انتخاب کنید.</span></div>
          <div className="avatar-picker-grid">
            {avatarLibrary.map((avatar) => <button key={avatar.id} type="button" aria-label={avatar.label} aria-pressed={draftAvatarId === avatar.id} onClick={() => setDraftAvatarId(avatar.id)} className={draftAvatarId === avatar.id ? "selected" : ""}><UserAvatar avatarId={avatar.id} name={avatar.label} className="h-full w-full" /></button>)}
          </div>
        </section>
        <div className="form-actions">
          <NeutralButton
            onClick={saveProfile}
          >
            <Check />
            ذخیره تغییرات
          </NeutralButton>
          <NeutralButton onClick={resetProfile}>انصراف</NeutralButton>
        </div>
      </Panel>
    </div>
  );
}

function OrganizationPage({ notify }: { notify: (v: string) => void }) {
  const { organization, loading, error, capabilities, displayCopy, updateOrganization } = useOrganization();
  const { members } = useMembers();
  const form = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: organization ?? initialOrganization,
    mode: "onChange",
  });
  const values = useWatch({ control: form.control });
  const logo = useWatch({ control: form.control, name: "logo" });
  function pickLogo(file: File | null) {
    form.setValue("logo", file ? URL.createObjectURL(file) : null, {
      shouldDirty: true,
    });
  }
  const update = (key: Exclude<keyof OrganizationFormValues, "logo">) =>
    (value: string) => form.setValue(key, value, { shouldDirty: true, shouldValidate: true });
  const canUpdateOrganization = !loading && capabilities.canUpdateOrganization && Boolean(updateOrganization);
  const canSubmitOrganization = canUpdateOrganization && form.formState.isDirty && form.formState.isValid && !form.formState.isSubmitting;
  async function submitOrganization(values: OrganizationFormValues) {
    if (!updateOrganization) {
      form.setError("root", { message: error ?? displayCopy.actionUnavailable });
      return;
    }
    const result = await updateOrganization(values);
    if (!result.ok) {
      form.setError("root", { message: result.message ?? error ?? displayCopy.actionUnavailable });
      return;
    }
    form.reset(result.organization ?? values);
    notify("تنظیمات سازمان ذخیره شد");
  }
  function resetOrganization() {
    form.reset(organization ?? initialOrganization);
  }
  return (
    <div className="settings-view">
      <Panel className="org-hero">
        <img src={logo ?? ""} alt="" />
        <div>
          <h1>
            {organization?.name ?? ""} <span className="status-badge">فعال</span>
          </h1>
          <p>مدیریت حساب و تنظیمات سازمان</p>
          <small>slug: {organization?.slug ?? ""}</small>
        </div>
        <div className="org-facts">
          <span>
            <b>—</b>
            <small>پلن فعلی</small>
          </span>
          <span>
            <strong>{members.length.toLocaleString("fa-IR")}</strong>
            <small>تعداد اعضا</small>
          </span>
          <span>
            <b dir="ltr">{organization?.site ?? ""}</b>
            <small>وب‌سایت</small>
          </span>
        </div>
      </Panel>
      <Panel className="form-panel">
        <header>
          <h2>تنظیمات سازمان</h2>
          <p>اطلاعات و تنظیمات اصلی سازمان خود را مدیریت کنید.</p>
        </header>
        <form onSubmit={form.handleSubmit(submitOrganization)}>
        <div className="org-form-grid">
          <Field
            label="نام سازمان"
            value={values.name ?? ""}
            onChange={update("name")}
            help={form.formState.errors.name?.message}
          />
          <Field
            label="نام نمایشی"
            value={values.display ?? ""}
            onChange={update("display")}
            help={form.formState.errors.display?.message}
          />
          <Field
            label="دامنه یا Slug"
            value={values.slug ?? ""}
            onChange={update("slug")}
            dir="ltr"
            help={form.formState.errors.slug?.message ?? "برای لینک‌های دعوت و شناسه سازمان استفاده می‌شود."}
          />
          <Field
            label="وب‌سایت"
            value={values.site ?? ""}
            onChange={update("site")}
            dir="ltr"
            help={form.formState.errors.site?.message}
          />
          <Field
            label="ایمیل سازمانی"
            value={values.email ?? ""}
            onChange={update("email")}
            dir="ltr"
            help={form.formState.errors.email?.message}
          />
          <Field
            label="شماره تماس"
            value={values.phone ?? ""}
            onChange={update("phone")}
            dir="ltr"
          />
          <Field
            label="منطقه زمانی"
            value={values.timezone ?? ""}
            onChange={update("timezone")}
          />
          <Field
            label="آدرس"
            value={values.address ?? ""}
            onChange={update("address")}
          />
        </div>
        <div className="org-bottom">
          <label className="settings-field">
            <span>توضیحات کوتاه</span>
            <textarea
              value={values.desc ?? ""}
              onChange={(e) => update("desc")(e.target.value)}
            />
          </label>
          <ImagePicker value={logo ?? null} onChange={pickLogo} label="لوگوی سازمان" />
        </div>
        <div className="form-actions">
          {form.formState.errors.root?.message && <small className="text-destructive">{String(form.formState.errors.root.message)}</small>}
          <NeutralButton type="submit" disabled={!canSubmitOrganization}>
            <Check />
            {loading ? displayCopy.loading : "ذخیره تغییرات"}
          </NeutralButton>
          <NeutralButton onClick={resetOrganization}>انصراف</NeutralButton>
        </div>
        </form>
      </Panel>
    </div>
  );
}

function TeamsPage({ notify }: { notify: (v: string) => void }) {
  const {
    teams,
    serviceAvailable,
    loading,
    error,
    capabilities,
    displayCopy,
    createTeam,
    updateTeam,
    addMemberToTeam,
    removeMemberFromTeam,
    setTeamLead,
  } = useTeams();
  const { members } = useMembers();
  const [query, setQuery] = useState(""),
    [createOpen, setCreateOpen] = useState(false),
    [editOpen, setEditOpen] = useState(false),
    [manageTeamId, setManageTeamId] = useState<string | null>(null),
    [showTeamFilters, setShowTeamFilters] = useState(false),
    [leadFilter, setLeadFilter] = useState("all"),
    [memberFilter, setMemberFilter] = useState("all"),
    [createName, setCreateName] = useState(""),
    [createDescription, setCreateDescription] = useState(""),
    [createLeadId, setCreateLeadId] = useState("none"),
    [createMemberIds, setCreateMemberIds] = useState<string[]>([]),
    [editTeamId, setEditTeamId] = useState<string | null>(null),
    [editName, setEditName] = useState(""),
    [editDescription, setEditDescription] = useState(""),
    [editLeadId, setEditLeadId] = useState("none"),
    [editMemberIds, setEditMemberIds] = useState<string[]>([]),
    [formError, setFormError] = useState(""),
    [memberToAdd, setMemberToAdd] = useState(""),
    [manageError, setManageError] = useState("");
  const visible = useMemo(
    () => teams.filter((team) => (
      `${team.name} ${team.description ?? ""}`.includes(query)
      && (leadFilter === "all" || team.leadId === leadFilter)
      && (memberFilter === "all" || team.memberIds.includes(memberFilter))
    )),
    [teams, query, leadFilter, memberFilter],
  );
  const managedTeam = manageTeamId
    ? teams.find((team) => team.id === manageTeamId)
    : undefined;
  const canCreateTeam = serviceAvailable && !loading && capabilities.canCreateTeam && Boolean(createTeam);
  const canUpdateTeam = serviceAvailable && !loading && capabilities.canUpdateTeam && Boolean(updateTeam);
  const canAddTeamMember = serviceAvailable && !loading && capabilities.canAddTeamMember && Boolean(addMemberToTeam);
  const canRemoveTeamMember = serviceAvailable && !loading && capabilities.canRemoveTeamMember && Boolean(removeMemberFromTeam);
  const canSetTeamLead = serviceAvailable && !loading && capabilities.canSetTeamLead && Boolean(setTeamLead);

  const toggleMember = (
    memberId: string,
    selectedIds: string[],
    setSelectedIds: (value: string[]) => void,
  ) => {
    setSelectedIds(
      selectedIds.includes(memberId)
        ? selectedIds.filter((id) => id !== memberId)
        : [...selectedIds, memberId],
    );
  };
  const selectLead = (
    memberId: string,
    setLeadId: (value: string) => void,
    selectedIds: string[],
    setSelectedIds: (value: string[]) => void,
  ) => {
    setLeadId(memberId);
    if (memberId !== "none" && !selectedIds.includes(memberId)) {
      setSelectedIds([...selectedIds, memberId]);
    }
  };
  const resetCreateForm = () => {
    setCreateName("");
    setCreateDescription("");
    setCreateLeadId("none");
    setCreateMemberIds([]);
    setFormError("");
  };
  const submitCreate = async () => {
    if (!createTeam) {
      setFormError(error ?? displayCopy.actionUnavailable);
      return;
    }
    const result = await createTeam({
      name: createName,
      description: createDescription || undefined,
      leadId: createLeadId === "none" ? undefined : createLeadId,
      memberIds: createMemberIds,
    });
    if (!result.ok) {
      setFormError(result.message ?? error ?? displayCopy.actionUnavailable);
      return;
    }

    resetCreateForm();
    setCreateOpen(false);
    notify(`تیم ${result.team?.name ?? createName} ایجاد شد`);
  };
  const openEdit = (teamId: string) => {
    const team = teams.find((currentTeam) => currentTeam.id === teamId);
    if (!team) return;

    setEditTeamId(team.id);
    setEditName(team.name);
    setEditDescription(team.description ?? "");
    setEditLeadId(team.leadId ?? "none");
    setEditMemberIds(team.memberIds);
    setFormError("");
    setEditOpen(true);
  };
  const submitEdit = async () => {
    if (!editTeamId) return;
    if (!updateTeam) {
      setFormError(error ?? displayCopy.actionUnavailable);
      return;
    }
    const result = await updateTeam(editTeamId, {
      name: editName,
      description: editDescription || undefined,
      leadId: editLeadId === "none" ? undefined : editLeadId,
      memberIds: editMemberIds,
    });
    if (!result.ok) {
      setFormError(result.message ?? error ?? displayCopy.actionUnavailable);
      return;
    }

    setEditOpen(false);
    setEditTeamId(null);
    setFormError("");
    notify("تغییرات تیم ذخیره شد");
  };
  const openManage = (teamId: string) => {
    setManageTeamId(teamId);
    setMemberToAdd("");
    setManageError("");
  };
  const addManagedMember = async () => {
    if (!managedTeam || !memberToAdd) return;
    if (!addMemberToTeam) {
      setManageError(error ?? displayCopy.actionUnavailable);
      return;
    }
    const result = await addMemberToTeam(managedTeam.id, memberToAdd);
    if (!result.ok) {
      setManageError(result.message ?? error ?? displayCopy.actionUnavailable);
      return;
    }

    setMemberToAdd("");
    setManageError("");
  }
  return (
    <div className="settings-view">
      <Panel className="team-stats">
        {[
          { l: "تعداد تیم‌ها", v: teams.length, s: "تیم فعال", i: UsersRound },
          { l: "تعداد اعضا", v: new Set(teams.flatMap((team) => team.memberIds)).size, s: "عضو در کل تیم‌ها", i: User },
          { l: "دعوت‌های در انتظار", v: 0, s: "در دسترس نیست", i: Mail },
          {
            l: "پروژه‌های فعال",
            v: 0,
            s: "در دسترس نیست",
            i: FolderKanban,
          },
        ].map((x) => (
          <article key={x.l}>
            <i>
              <x.i />
            </i>
            <div>
              <span>{x.l}</span>
              <strong>{x.v.toLocaleString("fa-IR")}</strong>
              <small>{x.s}</small>
            </div>
          </article>
        ))}
      </Panel>
      <Panel className="teams-panel">
        <header>
          <div>
            <h1>مدیریت تیم‌ها</h1>
            <p>
              تیم‌های سازمان خود را مدیریت کنید، اعضا را دعوت کنید و فعالیت‌ها
              را پیگیری نمایید.
            </p>
          </div>
          <NeutralButton disabled={!canCreateTeam} onClick={() => { resetCreateForm(); setCreateOpen(true); }}>
            <Plus />
            ایجاد تیم جدید
          </NeutralButton>
        </header>
        <div className="team-tools">
          <label>
            <Search />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جستجوی تیم‌ها..."
            />
          </label>
          <NeutralButton onClick={() => setShowTeamFilters((current) => !current)}>فیلتر</NeutralButton>
        </div>
        {showTeamFilters && <div className="team-tools">
          <label>
            سرپرست
            <Select value={leadFilter} onValueChange={setLeadFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه سرپرست‌ها</SelectItem>
                {members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
          <label>
            عضو
            <Select value={memberFilter} onValueChange={setMemberFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">همه اعضا</SelectItem>
                {members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
        </div>}
        <div className="team-list">
          {visible.map((team) => {
            const teamMembers = team.memberIds
              .map((memberId) => members.find((member) => member.id === memberId))
              .filter((member): member is NonNullable<typeof member> => member !== undefined);
            const lead = team.leadId
              ? members.find((member) => member.id === team.leadId)
              : undefined;

            return <article key={team.id}>
              <i className={team.tone}>
                <Users />
              </i>
              <div className="team-name">
                <h2>{team.name}</h2>
                <p>{team.description}</p>
                <div className="mini-avatars">
                  {teamMembers.slice(0, 3).map((member) => (
                    <UserAvatar
                      key={member.id}
                      avatarId={member.avatarId}
                      name={member.name}
                    />
                  ))}
                </div>
              </div>
              <div>
                <span>تعداد اعضا</span>
                <b>{team.memberIds.length.toLocaleString("fa-IR")} عضو</b>
              </div>
              <div>
                <span>سرپرست تیم</span>
                <b>
                  {lead && <UserAvatar avatarId={lead.avatarId} name={lead.name} />}
                  {lead?.name ?? "—"}
                </b>
              </div>
              <div>
                <span>آخرین فعالیت</span>
                <b>{team.activity}</b>
              </div>
              <div className="team-row-actions">
                <span title="دعوت عضو پس از اتصال سرویس دعوت فعال می‌شود." className="cursor-not-allowed">
                  <Button
                    variant="surface"
                    className="team-action-button"
                    disabled
                  >
                    <UserPlus />
                    <span>دعوت عضو</span>
                  </Button>
                </span>
                <Button
                  variant="surface"
                  className="team-action-button"
                  onClick={() => openManage(team.id)}
                >
                  <Users />
                  <span>مشاهده اعضا</span>
                </Button>
                <DropdownMenu dir="rtl">
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="surface"
                      size="icon"
                      className="team-more-button"
                      aria-label="گزینه‌های بیشتر"
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent collisionPadding={12}>
                    <DropdownMenuItem
                      onSelect={() => openManage(team.id)}
                    >
                      مدیریت تیم
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={!canUpdateTeam}
                      onSelect={() => openEdit(team.id)}
                    >
                      ویرایش
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </article>
          })}
          {!visible.length && <div className="files-empty"><Users /><h2>تیمی پیدا نشد</h2><p>عبارت جستجو یا فیلترها را تغییر دهید.</p></div>}
        </div>
        <footer>
          نمایش {visible.length ? "۱" : "۰"} تا {visible.length.toLocaleString("fa-IR")} از{" "}
          {teams.length.toLocaleString("fa-IR")} تیم
        </footer>
      </Panel>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>ایجاد تیم جدید</DialogTitle>
            <DialogDescription>
            نام، سرپرست و اعضای تیم را انتخاب کنید.
            </DialogDescription>
          </DialogHeader>
          <div className="dialog-fields">
            <Field label="نام تیم" value={createName} onChange={setCreateName} />
            <Field label="توضیح" value={createDescription} onChange={setCreateDescription} />
            <label>
              انتخاب سرپرست
              <Select value={createLeadId} onValueChange={(memberId) => selectLead(memberId, setCreateLeadId, createMemberIds, setCreateMemberIds)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون سرپرست</SelectItem>
                  {members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <div className="dialog-fields"><span>انتخاب اعضا</span>{members.map((member) => <label key={member.id}><input type="checkbox" checked={createMemberIds.includes(member.id)} disabled={createLeadId === member.id} onChange={() => toggleMember(member.id, createMemberIds, setCreateMemberIds)} />{member.name}</label>)}</div>
            {formError && <small className="text-destructive">{formError}</small>}
          </div>
          <DialogFooter>
            <NeutralButton onClick={() => setCreateOpen(false)}>انصراف</NeutralButton>
            <NeutralButton disabled={!canCreateTeam} onClick={submitCreate}>{loading ? displayCopy.loading : "ایجاد"}</NeutralButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>ویرایش تیم</DialogTitle>
            <DialogDescription>اطلاعات و اعضای تیم را به‌روزرسانی کنید.</DialogDescription>
          </DialogHeader>
          <div className="dialog-fields">
            <Field label="نام تیم" value={editName} onChange={setEditName} />
            <Field label="توضیح" value={editDescription} onChange={setEditDescription} />
            <label>
              انتخاب سرپرست
              <Select value={editLeadId} onValueChange={(memberId) => selectLead(memberId, setEditLeadId, editMemberIds, setEditMemberIds)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون سرپرست</SelectItem>
                  {members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <div className="dialog-fields"><span>انتخاب اعضا</span>{members.map((member) => <label key={member.id}><input type="checkbox" checked={editMemberIds.includes(member.id)} disabled={editLeadId === member.id} onChange={() => toggleMember(member.id, editMemberIds, setEditMemberIds)} />{member.name}</label>)}</div>
            {formError && <small className="text-destructive">{formError}</small>}
          </div>
          <DialogFooter>
            <NeutralButton onClick={() => setEditOpen(false)}>انصراف</NeutralButton>
            <NeutralButton disabled={!canUpdateTeam} onClick={submitEdit}>{loading ? displayCopy.loading : "ذخیره تغییرات"}</NeutralButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(managedTeam)} onOpenChange={(open) => { if (!open) setManageTeamId(null); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>مدیریت اعضای تیم</DialogTitle>
            <DialogDescription>{managedTeam?.name}</DialogDescription>
          </DialogHeader>
          {managedTeam && <div className="dialog-fields">
            <label>
              سرپرست تیم
              <Select disabled={!canSetTeamLead} value={managedTeam.leadId ?? "none"} onValueChange={async (memberId) => {
                if (!setTeamLead) {
                  setManageError(error ?? displayCopy.actionUnavailable);
                  return;
                }
                const result = await setTeamLead(managedTeam.id, memberId === "none" ? undefined : memberId);
                if (!result.ok) {
                  setManageError(result.message ?? error ?? displayCopy.actionUnavailable);
                  return;
                }
                setManageError("");
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون سرپرست</SelectItem>
                  {members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <label>
              افزودن عضو موجود
              <Select value={memberToAdd || "none"} onValueChange={(memberId) => setMemberToAdd(memberId === "none" ? "" : memberId)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">انتخاب عضو</SelectItem>
                  {members.filter((member) => !managedTeam.memberIds.includes(member.id)).map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </label>
            <NeutralButton onClick={addManagedMember} disabled={!canAddTeamMember || !memberToAdd}>{loading ? displayCopy.loading : "افزودن عضو"}</NeutralButton>
            <div className="dialog-fields">
              <span>اعضای فعلی</span>
              {managedTeam.memberIds.length ? members.filter((member) => managedTeam.memberIds.includes(member.id)).map((member) => <div key={member.id} className="setting-row"><span>{member.name}{managedTeam.leadId === member.id ? " · سرپرست" : ""}</span><NeutralButton danger disabled={!canRemoveTeamMember} onClick={async () => { if (!removeMemberFromTeam) { setManageError(error ?? displayCopy.actionUnavailable); return; } const result = await removeMemberFromTeam(managedTeam.id, member.id); if (!result.ok) setManageError(result.message ?? error ?? displayCopy.actionUnavailable); }}>حذف</NeutralButton></div>) : <small>عضوی در این تیم وجود ندارد.</small>}
            </div>
            {manageError && <small className="text-destructive">{manageError}</small>}
          </div>}
          <DialogFooter><NeutralButton onClick={() => setManageTeamId(null)}>بستن</NeutralButton></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SecurityPage() {
  const {
    serviceAvailable,
    loading,
    securityStatus,
    twoFactor,
    passwordInfo,
    sessions,
    preferences,
    loginAlerts,
    capabilities,
    displayCopy,
    enableTwoFactor,
    disableTwoFactor,
    changePassword,
    revokeSession,
    revokeAllSessions,
    updateSecurityPreferences,
    updateLoginAlerts,
  } = useSecurity();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordDraft, setPasswordDraft] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [passwordError, setPasswordError] = useState("");
  const isSecurityDataAvailable = serviceAvailable && !loading;
  const twoFactorMutation = twoFactor?.enabled ? disableTwoFactor : enableTwoFactor;
  const canManageTwoFactor = isSecurityDataAvailable && Boolean(twoFactor) && capabilities.canManageTwoFactor && Boolean(twoFactorMutation);
  const canChangePassword = isSecurityDataAvailable && capabilities.canChangePassword && Boolean(changePassword);
  const canViewSessions = isSecurityDataAvailable && capabilities.canViewSessions;
  const canRevokeSessions = canViewSessions && capabilities.canRevokeSession && Boolean(revokeSession);
  const canRevokeAllSessions = canViewSessions && capabilities.canRevokeAllSessions && Boolean(revokeAllSessions);
  const canManagePreferences = isSecurityDataAvailable && Boolean(preferences) && capabilities.canManageSecurityPreferences && Boolean(updateSecurityPreferences);
  const canManageLoginAlerts = isSecurityDataAvailable && Boolean(loginAlerts) && capabilities.canManageLoginAlerts && Boolean(updateLoginAlerts);
  const summaryStatus = securityStatus
    ? ({ secure: "امن", "needs-attention": "نیازمند بررسی", unknown: "نامشخص" }[securityStatus.state])
    : displayCopy.securityStatusUnavailable;
  const twoFactorStatus = twoFactor
    ? (twoFactor.enabled ? "فعال" : "غیرفعال")
    : displayCopy.serviceUnavailable;
  const passwordStatus = passwordInfo?.lastChangedAt ?? displayCopy.passwordInfoUnavailable;

  const closePasswordDialog = () => {
    setPasswordDialogOpen(false);
    setPasswordDraft({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setPasswordError("");
  };

  const submitPasswordChange = async () => {
    if (!changePassword || !canChangePassword) return;
    if (!passwordDraft.currentPassword.trim()) {
      setPasswordError("رمز فعلی را وارد کنید.");
      return;
    }
    if (passwordDraft.newPassword.length < 8) {
      setPasswordError("رمز جدید باید حداقل ۸ کاراکتر باشد.");
      return;
    }
    if (!passwordDraft.confirmPassword || passwordDraft.confirmPassword !== passwordDraft.newPassword) {
      setPasswordError("تأیید رمز با رمز جدید یکسان نیست.");
      return;
    }

    const result = await changePassword(passwordDraft);
    if (!result.ok) {
      setPasswordError(result.message ?? displayCopy.passwordInfoUnavailable);
      return;
    }

    closePasswordDialog();
  };

  const changeTwoFactor = async () => {
    if (!canManageTwoFactor || !twoFactorMutation) return;
    await twoFactorMutation();
  };

  const changePreference = async (key: keyof NonNullable<typeof preferences>, checked: boolean) => {
    if (!canManagePreferences || !updateSecurityPreferences) return;
    await updateSecurityPreferences({ [key]: checked });
  };

  const changeLoginAlert = async (key: keyof NonNullable<typeof loginAlerts>, checked: boolean) => {
    if (!canManageLoginAlerts || !updateLoginAlerts) return;
    await updateLoginAlerts({ [key]: checked });
  };

  const preferenceRows = [
    { key: "autoLockAfterInactivity", title: "قفل خودکار پس از بی‌تحرکی" },
    { key: "requireTwoFactorForAllMembers", title: "الزامی کردن تأیید دو مرحله‌ای برای تمام اعضا" },
    { key: "restrictAllowedIpAddresses", title: "محدودیت آی‌پی‌های مجاز" },
  ] as const;
  const loginAlertRows = [
    { key: "notifyOnNewDevice", title: "اطلاع‌رسانی ورود از دستگاه جدید" },
    { key: "notifyOnFailedLogin", title: "اطلاع‌رسانی ورود ناموفق" },
  ] as const;

  return (
    <div className="settings-view security-view">
      <div className="view-title">
        <h1>امنیت</h1>
        <p>مدیریت امنیت حساب و محافظت از اطلاعات شما</p>
      </div>
      <Panel className="security-overview">
        <div className="security-overview-intro">
          <h2>نمای کلی امنیت</h2>
          <p>{summaryStatus}</p>
          <span className="status-badge">{isSecurityDataAvailable ? summaryStatus : displayCopy.serviceUnavailable}</span>
          <i>
            <ShieldCheck />
          </i>
        </div>
        <article>
          <b>تأیید دو مرحله‌ای</b>
          <span>{twoFactorStatus}</span>
        </article>
        <article>
          <b>آخرین تغییر رمز عبور</b>
          <span>{passwordStatus}</span>
        </article>
        <article>
          <b>ضعف‌های امنیتی</b>
          <span>{summaryStatus}</span>
        </article>
      </Panel>
      <Panel className="security-feature">
        <i>
          <Shield />
        </i>
        <div>
          <h2>
            تأیید دو مرحله‌ای{" "}
            <span className="status-badge">{twoFactorStatus}</span>
          </h2>
          <p>{twoFactor ? `روش پیکربندی‌شده: ${twoFactor.method ?? "نامشخص"}` : displayCopy.twoFactorUnavailable}</p>
          <small>{twoFactor?.configuredAt ?? displayCopy.passwordInfoUnavailable}</small>
        </div>
        <div className="security-actions security-actions--deferred">
          <span title={displayCopy.twoFactorUnavailable} className={!canManageTwoFactor ? "cursor-not-allowed" : ""}>
            <NeutralButton disabled={!canManageTwoFactor} onClick={() => void changeTwoFactor()}>
              مدیریت احرازکننده
            </NeutralButton>
          </span>
          <span title={displayCopy.twoFactorUnavailable} className={!canManageTwoFactor ? "cursor-not-allowed" : ""}>
            <NeutralButton disabled={!canManageTwoFactor} onClick={() => void changeTwoFactor()}>
              تغییر وضعیت
            </NeutralButton>
          </span>
        </div>
      </Panel>
      <Panel className="security-feature">
        <i>
          <KeyRound />
        </i>
        <div>
          <h2>تغییر رمز عبور</h2>
          <p>{isSecurityDataAvailable ? passwordStatus : displayCopy.passwordChangeUnavailable}</p>
          <small>{passwordStatus}</small>
        </div>
        <span className="security-deferred-action" title={displayCopy.passwordChangeUnavailable}>
          <NeutralButton disabled={!canChangePassword} onClick={() => setPasswordDialogOpen(true)}>تغییر رمز</NeutralButton>
        </span>
      </Panel>
      <Panel className="sessions-panel">
        <header>
          <h2>نشست‌ها و دستگاه‌های فعال</h2>
        </header>
        {!canViewSessions ? <div className="security-deferred-state"><i><Laptop /></i><div><strong>{displayCopy.passwordInfoUnavailable}</strong><p>{displayCopy.sessionsUnavailable}</p></div></div> : sessions.length === 0 ? <div className="security-deferred-state"><i><Laptop /></i><div><strong>نشست فعالی وجود ندارد</strong><p>{displayCopy.sessionsUnavailable}</p></div></div> : <div className="security-session-list">
          {sessions.map((session) => <div className="setting-row" key={session.id}><div className="setting-copy"><i><Laptop /></i><div><strong>{session.deviceLabel}</strong><span>{[session.browser, session.operatingSystem, session.location, session.ipAddress, session.lastActiveAt].filter(Boolean).join(" · ")}</span></div></div><NeutralButton disabled={!canRevokeSessions || session.isCurrent} onClick={() => revokeSession && void revokeSession(session.id)}>خروج از این دستگاه</NeutralButton></div>)}
          <NeutralButton disabled={!canRevokeAllSessions} onClick={() => revokeAllSessions && void revokeAllSessions()}>بستن همه نشست‌ها</NeutralButton>
        </div>}
      </Panel>
      <div className="security-bottom">
        <Panel>
          <h2>ترجیحات امنیتی</h2>
          {preferenceRows.map(({ key, title }) => (
            <SettingRow
              key={key}
              icon={<Shield />}
              title={title}
              text={displayCopy.preferencesUnavailable}
              checked={preferences?.[key] ?? false}
              disabled={!canManagePreferences}
              onCheckedChange={(checked) => void changePreference(key, checked)}
              className="security-deferred-row"
            />
          ))}
        </Panel>
        <Panel>
          <h2>هشدارهای ورود</h2>
          {loginAlertRows.map(
            ({ key, title }) => (
              <SettingRow
                key={key}
                icon={<Bell />}
                title={title}
                text={displayCopy.loginAlertsUnavailable}
                checked={loginAlerts?.[key] ?? false}
                disabled={!canManageLoginAlerts}
                onCheckedChange={(checked) => void changeLoginAlert(key, checked)}
                className="security-deferred-row"
              />
            ),
          )}
        </Panel>
      </div>
      <Dialog open={passwordDialogOpen} onOpenChange={(open) => { if (!open) closePasswordDialog(); }}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تغییر رمز عبور</DialogTitle><DialogDescription>{displayCopy.passwordChangeUnavailable}</DialogDescription></DialogHeader>
          <div className="dialog-fields">
            <label>رمز فعلی<input type="password" value={passwordDraft.currentPassword} onChange={(event) => setPasswordDraft((draft) => ({ ...draft, currentPassword: event.target.value }))} /></label>
            <label>رمز جدید<input type="password" value={passwordDraft.newPassword} onChange={(event) => setPasswordDraft((draft) => ({ ...draft, newPassword: event.target.value }))} /></label>
            <label>تأیید رمز جدید<input type="password" value={passwordDraft.confirmPassword} onChange={(event) => setPasswordDraft((draft) => ({ ...draft, confirmPassword: event.target.value }))} /></label>
            {passwordError && <small className="text-destructive">{passwordError}</small>}
          </div>
          <DialogFooter><NeutralButton onClick={closePasswordDialog}>انصراف</NeutralButton><NeutralButton onClick={() => void submitPasswordChange()} disabled={!canChangePassword || loading}>تغییر رمز</NeutralButton></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BillingPage() {
  const navigate = useNavigate();
  const { plans: pricingPlans } = usePlans();
  const { serviceAvailable, loading, error, billingAccount, subscription, usage, invoices, paymentMethods, capabilities, displayCopy, changePlan, updatePaymentMethod, updateBillingIdentity, downloadInvoice } = useBilling();
  const currentPlan = subscription ? pricingPlans.find((plan) => plan.id === subscription.planId) : undefined;
  const canChangePlan = serviceAvailable && !loading && capabilities.canChangePlan && Boolean(changePlan);
  const canUpdatePaymentMethod = serviceAvailable && !loading && capabilities.canUpdatePaymentMethod && Boolean(updatePaymentMethod);
  const canManageBillingIdentity = serviceAvailable && !loading && capabilities.canManageBillingIdentity && Boolean(updateBillingIdentity);
  const canDownloadInvoice = serviceAvailable && !loading && capabilities.canDownloadInvoice && Boolean(downloadInvoice);
  const [billingIdentityOpen, setBillingIdentityOpen] = useState(false);
  const [paymentMethodOpen, setPaymentMethodOpen] = useState(false);
  const [billingIdentityDraft, setBillingIdentityDraft] = useState({ legalName: "", taxId: "", billingEmail: "", address: "" });
  const [billingActionError, setBillingActionError] = useState<string | null>(null);
  const billingPlans = pricingPlans
    .filter((plan) => plan.id !== "free")
    .map((plan) => ({
      ...plan,
      current: plan.id === subscription?.planId,
      price: plan.id === "enterprise" ? "تماس با ما" : plan.priceMonthly.toLocaleString("fa-IR"),
    }));
  const selectPlan = (planId: string, active: boolean) => {
    if (!canChangePlan || !active || planId === subscription?.planId || !changePlan) return;
    void changePlan(planId);
  };
  const openBillingIdentity = () => {
    if (!billingAccount) return;
    setBillingActionError(null);
    setBillingIdentityDraft({ legalName: billingAccount.legalName ?? "", taxId: billingAccount.taxId ?? "", billingEmail: billingAccount.billingEmail ?? "", address: billingAccount.address ?? "" });
    setBillingIdentityOpen(true);
  };
  const saveBillingIdentity = async () => {
    if (!updateBillingIdentity) return;
    const result = await updateBillingIdentity(billingIdentityDraft);
    if (result.ok) setBillingIdentityOpen(false);
    else setBillingActionError(result.message ?? displayCopy.actionUnavailable);
  };
  const updateDefaultPaymentMethod = async (paymentMethodId: string) => {
    if (!updatePaymentMethod) return;
    const result = await updatePaymentMethod(paymentMethodId);
    if (result.ok) setPaymentMethodOpen(false);
    else setBillingActionError(result.message ?? displayCopy.actionUnavailable);
  };
  return (
    <div className="settings-view">
      <div className="view-title">
        <h1>اشتراک</h1>
        <p>پلن فعلی سازمان و مدیریت صورت‌حساب</p>
      </div>
      <Panel className="plan-hero">
        <i>
          <CreditCard />
        </i>
        <div>
          <small>پلن فعلی</small>
          <h1>{currentPlan?.name ?? displayCopy.serviceUnavailable}</h1>
          <p>{currentPlan?.description ?? (loading ? displayCopy.loading : error ?? displayCopy.billingUnavailable)}</p>
          {currentPlan && <strong>{currentPlan.priceMonthly.toLocaleString("fa-IR")} تومان / ماهیانه</strong>}
          <div className="usage-bars">
            {usage?.metrics.map((metric) => <span key={metric.key}>
              {metric.label} {metric.used.toLocaleString("fa-IR")} از {metric.limit?.toLocaleString("fa-IR") ?? "نامحدود"}
              <i><b style={{ width: metric.limit ? `${Math.min(100, (metric.used / metric.limit) * 100)}%` : "0%" }} /></i>
            </span>)}
            {!usage && <span>{loading ? displayCopy.loading : error ?? displayCopy.billingUnavailable}</span>}
          </div>
        </div>
        <div className="plan-meta">
          <span className="status-badge">{subscription?.status ?? displayCopy.serviceUnavailable}</span>
          <p>
            دوره پرداخت<strong>{subscription?.currentPeriodStart ? `${subscription.currentPeriodStart} تا ${subscription.currentPeriodEnd ?? "—"}` : "—"}</strong>
          </p>
          <p>
            تاریخ تمدید<strong>{subscription?.renewalDate ?? "—"}</strong>
          </p>
          <NeutralButton disabled={!canManageBillingIdentity || !billingAccount} onClick={openBillingIdentity}>
            مدیریت صورت‌حساب
          </NeutralButton>
        </div>
      </Panel>
      <div className="billing-grid">
        <div>
          <div id="settings-billing-plan-selection">
          <Panel className="plans-panel">
            <header>
              <NeutralButton onClick={() => navigate("/admin/plans")}>
                مشاهده همه پلن‌ها <ChevronLeft />
              </NeutralButton>
            </header>
            <div>
              {billingPlans.map((plan) => (
                <article className={plan.current ? "current" : ""} key={plan.id}>
                  {plan.current && (
                    <span className="status-badge">پلن فعلی</span>
                  )}
                  <h2>{plan.name}</h2>
                  <p>
                    {plan.price} {plan.price !== "تماس با ما" && "تومان / ماهیانه"}
                  </p>
                  {plan.features.map((f) => (
                    <span key={f}>
                      <Check />
                      {f}
                    </span>
                  ))}
                  <NeutralButton
                    onClick={() => selectPlan(plan.id, plan.active)}
                    disabled={!canChangePlan || plan.current || !plan.active || plan.id === "enterprise"}
                  >
                    {plan.current
                      ? "پلن فعلی"
                      : plan.price === "تماس با ما"
                        ? "تماس با فروش"
                        : `ارتقا به ${plan.name}`}
                  </NeutralButton>
                </article>
              ))}
            </div>
          </Panel>
          </div>
          <Panel className="transactions">
            <h2>تراکنش‌های اخیر</h2>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>شماره صورت‌حساب</th>
                    <th>تاریخ</th>
                    <th>دوره</th>
                    <th>مبلغ</th>
                    <th>وضعیت</th>
                    <th>دریافت رسید</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>{invoice.number}</td>
                      <td>{invoice.issuedAt}</td>
                      <td>{invoice.dueAt ?? "—"}</td>
                      <td>{invoice.amount.toLocaleString("fa-IR")} {invoice.currency}</td>
                      <td>
                        <span className="status-badge">{invoice.status}</span>
                      </td>
                      <td>
                        <NeutralButton disabled={!canDownloadInvoice} onClick={() => downloadInvoice && void downloadInvoice(invoice.id)}><Download />دریافت رسید</NeutralButton>
                      </td>
                    </tr>
                  ))}
                  {!invoices.length && <tr><td colSpan={6}>{loading ? displayCopy.loading : error ?? displayCopy.billingUnavailable}</td></tr>}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
        <aside>
          <Panel>
            <h2>اطلاعات صورت‌حساب</h2>
            <p>
              نام صورتحساب<strong>{billingAccount?.legalName ?? "—"}</strong>
            </p>
            <p>
              شناسه صورتحساب<strong>{billingAccount?.id ?? "—"}</strong>
            </p>
            <p>
              کد اقتصادی<strong>{billingAccount?.taxId ?? "—"}</strong>
            </p>
            <NeutralButton disabled={!canManageBillingIdentity || !billingAccount} onClick={openBillingIdentity}>
              ویرایش اطلاعات
            </NeutralButton>
          </Panel>
          <Panel>
            <h2>روش پرداخت</h2>
            <p>
              {paymentMethods[0]?.type ?? "—"}<strong>{paymentMethods[0]?.lastFour ? `**** **** **** ${paymentMethods[0].lastFour}` : "—"}</strong>
            </p>
            <small>تاریخ انقضا: {paymentMethods[0]?.expiresAt ?? "—"}</small>
            <NeutralButton disabled={!canUpdatePaymentMethod || !paymentMethods.length} onClick={() => { setBillingActionError(null); setPaymentMethodOpen(true); }}>
              تغییر روش پرداخت
            </NeutralButton>
          </Panel>
          <Panel className="upgrade-card">
            <i>↗</i>
            <h2>به پلن بالاتر ارتقا دهید</h2>
            <p>با ارتقا، از امکانات بیشتر و گزارش‌های پیشرفته بهره‌مند شوید.</p>
            <NeutralButton onClick={() => document.getElementById("settings-billing-plan-selection")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
              ارتقای پلن
            </NeutralButton>
          </Panel>
        </aside>
      </div>
      <Dialog open={billingIdentityOpen} onOpenChange={setBillingIdentityOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>ویرایش اطلاعات صورت‌حساب</DialogTitle></DialogHeader>
          <div className="grid gap-3">
            <Input value={billingIdentityDraft.legalName} onChange={(event) => setBillingIdentityDraft((draft) => ({ ...draft, legalName: event.target.value }))} placeholder="نام صورتحساب" />
            <Input value={billingIdentityDraft.taxId} onChange={(event) => setBillingIdentityDraft((draft) => ({ ...draft, taxId: event.target.value }))} placeholder="کد اقتصادی" />
            <Input value={billingIdentityDraft.billingEmail} onChange={(event) => setBillingIdentityDraft((draft) => ({ ...draft, billingEmail: event.target.value }))} placeholder="ایمیل صورت‌حساب" />
            <Input value={billingIdentityDraft.address} onChange={(event) => setBillingIdentityDraft((draft) => ({ ...draft, address: event.target.value }))} placeholder="نشانی" />
            {billingActionError && <p className="text-sm text-destructive">{billingActionError}</p>}
          </div>
          <DialogFooter><NeutralButton onClick={() => setBillingIdentityOpen(false)}>انصراف</NeutralButton><NeutralButton onClick={() => void saveBillingIdentity()} disabled={!canManageBillingIdentity || loading}>ذخیره</NeutralButton></DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={paymentMethodOpen} onOpenChange={setPaymentMethodOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تغییر روش پرداخت</DialogTitle></DialogHeader>
          <div className="grid gap-2">{paymentMethods.map((method) => <NeutralButton key={method.id} onClick={() => void updateDefaultPaymentMethod(method.id)} disabled={!canUpdatePaymentMethod || loading}>{method.label}</NeutralButton>)}{billingActionError && <p className="text-sm text-destructive">{billingActionError}</p>}</div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NotificationsPage() {
  const {
    serviceAvailable,
    loading,
    channels,
    preferences,
    canManageService,
    canManageChannels,
    canManagePreferences,
    displayCopy,
    updateServiceAvailable,
    updateChannel,
    updatePreference,
  } = useNotifications();
  const activityRows = [
    { key: "assignedTask" as const, label: "وظایف محول‌شده" },
    { key: "comments" as const, label: "دیدگاه‌ها و نظرات" },
    { key: "statusChanges" as const, label: "تغییر وضعیت" },
    { key: "reminders" as const, label: "یادآوری‌ها" },
    { key: "digest" as const, label: "خلاصه روزانه / هفتگی" },
  ];
  const channelRows = [
    { key: "email" as const, label: "ایمیل" },
    { key: "push" as const, label: "پوش (Push)" },
    { key: "inApp" as const, label: "درون‌برنامه‌ای" },
  ];
  const serviceDisabled = loading || !canManageService || !updateServiceAvailable;
  const channelDisabled = loading || !canManageChannels || !updateChannel;
  const preferenceDisabled = loading || !canManagePreferences || !updatePreference;
  return (
    <div className="settings-view notifications-view">
      <div className="view-title">
        <h1>اعلان‌ها</h1>
        <p>{displayCopy.pageDescription}</p>
      </div>
      <Panel className="notification-overview">
        <div className="notification-overview-parent">
          <h2>وضعیت دسترسی کانال‌ها</h2>
          <span>
            <Switch
              checked={serviceAvailable}
              disabled={serviceDisabled}
              onCheckedChange={updateServiceAvailable ? (available) => void updateServiceAvailable(available) : undefined}
            />
            {displayCopy.availabilityStatus}
          </span>
          <p>{displayCopy.availabilityDescription}</p>
        </div>
        {channelRows.map(({ key, label }, i) => (
          <article key={key} className="notification-channel-summary">
            {i === 0 ? <Mail /> : i === 1 ? <Smartphone /> : <MessageSquare />}
            <b>{label}</b>
            <span>{displayCopy.channelDescription}</span>
          </article>
        ))}
      </Panel>
      <div className="notification-columns">
        <Panel className="notification-panel notification-activity">
          <h2>اعلان‌های فعالیت‌ها</h2>
          {activityRows.map(({ key, label }, i) => (
            <SettingRow
              key={key}
              icon={
                i === 1 ? (
                  <MessageSquare />
                ) : i === 4 ? (
                  <CalendarDays />
                ) : (
                  <Bell />
                )
              }
              title={label}
              text={displayCopy.preferenceDescription}
              checked={preferences[key]}
              disabled={preferenceDisabled}
              onCheckedChange={updatePreference ? (checked) => void updatePreference(key, checked) : undefined}
            />
          ))}
        </Panel>
        <Panel className="notification-panel notification-delivery">
          <h2>ترجیحات دریافت اعلان</h2>
          {channelRows.map(({ key, label }, i) => (
            <SettingRow
              key={key}
              icon={
                i === 0 ? (
                  <Mail />
                ) : i === 1 ? (
                  <Smartphone />
                ) : (
                  <MessageSquare />
                )
              }
              title={label}
              text={displayCopy.channelDescription}
              checked={channels[key]}
              disabled={channelDisabled}
              onCheckedChange={updateChannel ? (checked) => void updateChannel(key, checked) : undefined}
            />
          ))}
        </Panel>
        <p className="settings-note notification-help-note">
          {displayCopy.projectTeamNote}
        </p>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const requestedTab = new URLSearchParams(location.search).get("tab");
  const activeTab = tabs.some((tab) => tab.id === requestedTab)
    ? requestedTab as TabId
    : "profile";
  const [notice, setNotice] = useState("");
  return (
    <main className="settings-page" dir="rtl">
      <aside className="settings-nav">
        <header>
          <h1>تنظیمات</h1>
          <p>مدیریت حساب و سازمان</p>
        </header>
        <nav>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={activeTab === tab.id ? "active" : ""}
              onClick={() => {
                setNotice("");
                navigate(`/settings?tab=${tab.id}`);
              }}
            >
              <tab.icon />
              {tab.label}
            </button>
          ))}
        </nav>
      </aside>
      <div className="settings-content">
        {notice && (
          <button className="settings-toast" onClick={() => setNotice("")}>
            {notice}
          </button>
        )}
        {activeTab === "profile" && <ProfilePage notify={setNotice} />}
        {activeTab === "org" && <OrganizationPage notify={setNotice} />}
        {activeTab === "team" && <TeamsPage notify={setNotice} />}
        {activeTab === "security" && <SecurityPage />}
        {activeTab === "billing" && <BillingPage />}
        {activeTab === "notifications" && <NotificationsPage />}
      </div>
    </main>
  );
}
