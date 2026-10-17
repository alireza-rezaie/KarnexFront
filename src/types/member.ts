import type { Role } from '@/types/role';

export interface Member {
  id: string;
  name: string;
  email: string;
  jobTitle: string;
  roleId?: Role['id'];
  avatarId?: string | null;
  avatar: string;
  status: 'online' | 'offline' | 'busy';
  projects: string[];
  lastActivity: string;
}

export type AddMemberInput = Pick<Member, 'name' | 'email' | 'jobTitle' | 'roleId' | 'avatarId'>;
export type UpdateMemberInput = Partial<Omit<Member, 'id'>>;

export type MemberMutationResult =
  | { ok: true; member?: Member }
  | { ok: false; message?: string };

export interface MemberCapabilities {
  canAddMember: boolean;
  canUpdateMember: boolean;
}

export interface MemberDisplayCopy {
  serviceUnavailable: string;
  actionUnavailable: string;
  loading: string;
}
