import type { StatusDefinition } from '@/types/status';

export type BaseTaskStatus =
  | 'todo'
  | 'inprogress'
  | 'review'
  | 'done';

export type TaskStatus = StatusDefinition['id'];

export interface TaskChecklistItem {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  key: string;
  title: string;
  description: string;
  type: 'epic' | 'story' | 'task' | 'bug' | 'subtask';
  status: TaskStatus;
  priority: 'highest' | 'high' | 'medium' | 'low' | 'lowest';
  assignee: string;
  reporter: string;
  projectId: string;
  boardColumnId?: string;
  sprintId?: string;
  /** Kanban-only planning placement. Omitted tasks flow directly on the board. */
  inKanbanBacklog?: boolean;
  epicId?: string;
  labels: string[];
  storyPoints?: number;
  estimatedSeconds?: number;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  comments: number;
  attachments: number;
  subtasks: number;
  completedSubtasks: number;
  /** Persisted checklist data; legacy count fields remain for existing summaries. */
  subtaskItems?: TaskChecklistItem[];
  acceptanceCriteria?: TaskChecklistItem[];
}

export type CreateTaskInput = Omit<Task, 'id' | 'projectId'>;
/** Generic edits deliberately exclude workflow status. */
export type TaskUpdates = Partial<Omit<Task, 'id' | 'projectId' | 'status'>>;

export type TaskMutationResult =
  | { ok: true }
  | { ok: false; message?: string };

export type TaskCreateMutationResult =
  | { ok: true; task: Task }
  | { ok: false; message?: string };

export interface TaskCapabilities {
  canCreateTask: boolean;
  canUpdateTask: boolean;
}

export interface TaskDisplayCopy {
  serviceUnavailable: string;
  createUnavailable: string;
  updateUnavailable: string;
  loading: string;
}
