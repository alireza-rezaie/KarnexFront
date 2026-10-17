export interface Activity {
  id: string;
  userId: string;
  action: string;
  target: string;
  timestamp: string;
  type: 'task' | 'project' | 'sprint' | 'comment' | 'file';
}
