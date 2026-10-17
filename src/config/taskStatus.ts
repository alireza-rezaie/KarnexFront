import type { BaseTaskStatus } from '@/types/task';
import type { StatusDefinition } from '@/types/status';

export const statusConfig: Record<BaseTaskStatus, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
}> = {
  todo: { label: 'برای انجام', color: '#6b7280', bgColor: 'rgba(107, 114, 128, 0.15)', borderColor: 'rgba(107, 114, 128, 0.3)' },
  inprogress: { label: 'در حال انجام', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)', borderColor: 'rgba(59, 130, 246, 0.3)' },
  review: { label: 'بازبینی', color: '#8b5cf6', bgColor: 'rgba(139, 92, 246, 0.15)', borderColor: 'rgba(139, 92, 246, 0.3)' },
  done: { label: 'انجام شد', color: '#22c55e', bgColor: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.3)' },
};

const statusEntries = Object.entries(statusConfig) as Array<[BaseTaskStatus, (typeof statusConfig)[BaseTaskStatus]]>;

export const baseTaskStatuses: Array<StatusDefinition & { id: BaseTaskStatus }> = statusEntries.map(([id, status]) => ({
  id,
  name: status.label,
  color: status.color,
}));

export const isBaseTaskStatus = (value: string | undefined): value is BaseTaskStatus =>
  typeof value === 'string' && baseTaskStatuses.some((status) => status.id === value);

export const getBaseTaskStatusConfig = (value: string | undefined) =>
  isBaseTaskStatus(value) ? statusConfig[value] : undefined;
