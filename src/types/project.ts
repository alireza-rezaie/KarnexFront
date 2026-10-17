export interface Project {
  id: string;
  key: string;
  name: string;
  description: string;
  type: "scrum" | "kanban" | "basic";
  status: "active" | "archived" | "paused";
  privacy: "private" | "public";
  icon: string;
  color: string;
  progress: number;
  members: string[];
  /**
   * Project-scoped role assignments keyed by an existing Member.id.
   * `members` remains the membership list for compatibility with existing
   * routes; roles must not be read from the global member directory.
   */
  memberRoles?: Record<string, string>;
  sprintId?: string;
  startDate: string;
  endDate: string;
  tasksCount: number;
  completedTasks: number;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  name: string;
  status: "released" | "in_progress" | "planned";
  releaseDate: string | null;
}

export type CreateProjectInput = Omit<Project, "id">;
export type UpdateProjectInput = Partial<Omit<Project, "id">>;

export type ProjectMemberAccessInput = {
  memberId: string;
  roleId?: string;
};

export function getProjectMemberRole(project: Project, memberId: string, legacyRoleId?: string) {
  // Only legacy records that have no project-role map at all may use the
  // historical directory role. New projects always provide this map.
  return project.memberRoles === undefined ? legacyRoleId : project.memberRoles[memberId];
}

export type ProjectMutationResult =
  { ok: true; project: Project } | { ok: false; message?: string };

export interface ProjectCreateCapabilities {
  canCreateProject: boolean;
}

export interface ProjectDeleteCapabilities {
  canDeleteProject: boolean;
}

export interface ProjectSettingsCapabilities {
  canUpdateProject: boolean;
}

export interface ProjectAccessCapabilities {
  canManageProjectAccess: boolean;
}

export interface ProjectVersionCapabilities {
  canViewProjectVersions: boolean;
}

export interface ProjectDisplayCopy {
  createUnavailable: string;
  createLoading: string;
}
