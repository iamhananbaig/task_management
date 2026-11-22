import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { api } from "@/lib/api"
import type {
  AppNotification,
  AuditEntry,
  Comment,
  Paginated,
  Project,
  Status,
  Task,
  Transition,
  UserSummary,
  WorkflowTemplate,
} from "@/lib/types"

/**
 * Read hooks for the API. Every successful mutation marks all cached data stale (App.tsx),
 * so pages refresh after any change without per-mutation bookkeeping.
 */

export type TaskFilters = {
  project_id?: number
  assignee?: string
  reviewer?: string
  status_id?: number
  status_type?: string
  priority?: string
  due?: string
  search?: string
  include_done?: boolean
  sort?: string
  per_page?: number
}

export const useProjects = (archived = false) =>
  useQuery({
    queryKey: ["projects", { archived }],
    queryFn: async () => (await api.get<{ data: Project[] }>("/projects", { params: { archived: archived ? 1 : 0 } })).data.data,
  })

export const useProject = (id: number | string | undefined) =>
  useQuery({
    queryKey: ["projects", Number(id)],
    queryFn: async () => (await api.get<{ data: Project }>(`/projects/${id}`)).data.data,
    enabled: !!id,
  })

export const useBoard = (projectId: number | string | undefined, params: Record<string, unknown> = {}) =>
  useQuery({
    queryKey: ["board", Number(projectId), params],
    queryFn: async () => (await api.get<{ data: Task[] }>(`/projects/${projectId}/tasks`, { params })).data.data,
    enabled: !!projectId,
    placeholderData: keepPreviousData,
  })

export const useTasks = (filters: TaskFilters) =>
  useQuery({
    queryKey: ["tasks", filters],
    queryFn: async () =>
      (
        await api.get<Paginated<Task>>("/tasks", {
          params: { ...filters, include_done: filters.include_done ? 1 : undefined },
        })
      ).data,
    placeholderData: keepPreviousData,
  })

export const useTask = (id: number | string | null | undefined) =>
  useQuery({
    queryKey: ["task", Number(id)],
    queryFn: async () => (await api.get<{ data: Task }>(`/tasks/${id}`)).data.data,
    enabled: !!id,
  })

export const useComments = (taskId: number) =>
  useQuery({
    queryKey: ["task", taskId, "comments"],
    queryFn: async () => (await api.get<{ data: Comment[] }>(`/tasks/${taskId}/comments`)).data.data,
  })

export const useActivity = (taskId: number, enabled = true) =>
  useQuery({
    queryKey: ["task", taskId, "activity"],
    queryFn: async () => (await api.get<{ data: AuditEntry[] }>(`/tasks/${taskId}/activity`)).data.data,
    enabled,
  })

export const useMembers = (projectId: number | undefined) =>
  useQuery({
    queryKey: ["projects", projectId, "members"],
    queryFn: async () => (await api.get<{ data: UserSummary[] }>(`/projects/${projectId}/members`)).data.data,
    enabled: !!projectId,
  })

export const useUserOptions = () =>
  useQuery({
    queryKey: ["users", "options"],
    queryFn: async () => (await api.get<{ data: UserSummary[] }>("/users/options")).data.data,
    staleTime: 5 * 60_000,
  })

export const useWorkflow = (projectId: number | undefined) =>
  useQuery({
    queryKey: ["projects", projectId, "workflow"],
    queryFn: async () => (await api.get<{ statuses: Status[]; transitions: Transition[] }>(`/projects/${projectId}/workflow`)).data,
    enabled: !!projectId,
  })

export const useWorkflowTemplates = () =>
  useQuery({
    queryKey: ["workflow-templates"],
    queryFn: async () => (await api.get<{ data: WorkflowTemplate[] }>("/workflow-templates")).data.data,
  })

export type Dashboard = {
  counts: {
    open: number
    overdue: number
    due_today: number
    due_this_week: number
    to_review: number
    completed_this_week: number
  }
  projects: Project[]
  activity: AuditEntry[]
}

export const useDashboard = () =>
  useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => (await api.get<Dashboard>("/dashboard")).data,
  })

export const useNotifications = (unreadOnly = false) =>
  useQuery({
    queryKey: ["notifications", { unreadOnly }],
    queryFn: async () =>
      (await api.get<{ data: AppNotification[]; unread: number }>("/notifications", { params: { unread: unreadOnly ? 1 : 0 } })).data,
    // The bell polls so new assignments show without a reload
    refetchInterval: 60_000,
  })
