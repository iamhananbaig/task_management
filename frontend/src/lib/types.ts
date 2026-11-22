/** Shapes returned by the Laravel API (/api/v1). Keep in step with app/Http/Resources. */

export type StatusType = "open" | "active" | "review" | "done"
export type Priority = "low" | "medium" | "high" | "urgent"
export type TransitionActor = "assignee" | "reviewer" | "creator" | "project_manager" | "any_editor"
export type ProjectRole = "manager" | "member"

export interface UserSummary {
  id: number
  name: string
  email: string
  project_role?: ProjectRole
}

export interface Status {
  id: number
  name: string
  color: string
  type: StatusType
  position: number
  tasks_count?: number
}

export interface Transition {
  id: number
  from_status_id: number
  to_status_id: number
  label: string
  actors: TransitionActor[]
  requires_comment: boolean
  requires_attachment: boolean
}

export interface Project {
  id: number
  name: string
  key: string
  description: string | null
  color: string
  is_restricted: boolean
  escalate_after_days: number | null
  owner?: UserSummary
  archived_at: string | null
  created_at: string
  members_count?: number
  open_tasks_count?: number
  done_tasks_count?: number
  overdue_tasks_count?: number
  members?: UserSummary[]
  statuses?: Status[]
  transitions?: Transition[]
  can: { manage: boolean; delete: boolean; create_tasks: boolean } | null
}

export interface AvailableTransition {
  id: number
  label: string
  to_status_id: number
  /** Kind of status the move leads to (review / done prompt for evidence and open checklist items) */
  to_type?: StatusType | null
  requires_comment: boolean
  requires_attachment: boolean
}

export interface ChecklistItem {
  id: number
  title: string
  is_done: boolean
  position: number
}

export interface Attachment {
  id: number
  original_name: string
  mime_type: string | null
  size: number
  user?: UserSummary
  created_at: string
}

export interface Task {
  id: number
  reference: string
  number: number
  project: { id: number; key: string; name: string; color: string }
  title: string
  description: string | null
  status?: Status
  priority: Priority
  tags?: TaskTag[]
  routine_run?: { id: number; name: string } | null
  assignee?: UserSummary | null
  reviewer?: UserSummary | null
  creator?: UserSummary | null
  start_date: string | null
  due_date: string | null
  is_overdue: boolean | null
  completed_at: string | null
  position: number
  checklist_total?: number
  checklist_done?: number
  comments_count?: number
  attachments_count?: number
  created_at: string
  updated_at: string
  deleted_at: string | null
  available_transitions?: AvailableTransition[]
  // detail only
  checklist?: ChecklistItem[]
  attachments?: Attachment[]
  watchers?: UserSummary[]
  is_watching?: boolean
  can?: { update: boolean; delete: boolean; comment: boolean; remind: boolean } | null
}

export interface Comment {
  id: number
  body: string
  user?: UserSummary
  created_at: string
  edited_at: string | null
  can: { update: boolean; delete: boolean } | null
}

export interface AuditEntry {
  id: number
  user_id: number | null
  user_name: string | null
  action: string
  subject_type: string
  subject_id: number | null
  subject_label: string | null
  project_id: number | null
  task_id: number | null
  summary: string
  changes: Record<string, [unknown, unknown]> | null
  ip_address?: string
  created_at: string
}

export interface AppNotification {
  id: string
  data: {
    kind: string
    task_id: number | null
    run_id?: number
    project_id: number
    reference: string | null
    title: string
    body: string
  }
  read_at: string | null
  created_at: string
}

export interface WorkflowTemplate {
  id: number
  name: string
  description: string | null
  is_default: boolean
  definition: WorkflowDefinition
}

export interface WorkflowDefinition {
  statuses: { key: string; name: string; color: string; type: StatusType }[]
  transitions: { from: string; to: string; label: string; actors: TransitionActor[]; requires_comment: boolean; requires_attachment?: boolean }[]
}

export interface Paginated<T> {
  data: T[]
  meta?: { current_page: number; last_page: number; total: number; per_page: number }
}

export interface TaskTag {
  id: number
  name: string
  color: string
  tag_group_id: number
}

export interface TagGroup {
  id: number
  name: string
  tags: (TaskTag & { is_active: boolean })[]
}

export type Frequency = "weekly" | "monthly" | "quarterly" | "half_yearly" | "yearly"
export type DueRule = "days_after_end" | "day_of_next_month" | "days_before_end"

export interface RunProgress {
  total: number
  done: number
  review: number
  overdue: number
  on_time: number
}

export interface Run {
  id: number
  routine_id: number
  project_id: number
  name: string
  period_start: string
  period_end: string
  created_at: string
  progress: RunProgress
  routine?: { id: number; name: string }
  project?: { id: number; name: string; key: string; color: string }
}

export interface RoutineItem {
  id?: number
  title: string
  description: string | null
  priority: Priority
  assignee_id: number | null
  reviewer_id: number | null
  checklist: string[]
  tag_ids: number[]
  due_rule: DueRule
  due_value: number
}

export interface Routine {
  id: number
  project_id: number
  name: string
  description?: string | null
  frequency: Frequency
  lead_days: number
  is_active: boolean
  next_period_end: string
  next_period_name: string
  next_run_on: string
  items_count: number
  last_run: { id: number; name: string } | null
  items?: RoutineItem[]
  runs?: Run[]
  can_manage?: boolean
}
