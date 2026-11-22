import { useQuery } from '@tanstack/react-query';

import { api } from '@/lib/api';
import type { AppNotification, Comment, Paginated, Project, Run, Task, UserSummary } from '@/lib/types';

/** Read hooks (same endpoints as the web app). Every successful change refreshes all of them (app/_layout). */

export type TaskFilters = {
  project_id?: number;
  routine_run_id?: number;
  assignee?: string;
  reviewer?: string;
  status_type?: string;
  due?: string;
  include_done?: boolean;
  sort?: string;
  per_page?: number;
  search?: string;
};

export const useTasks = (filters: TaskFilters) =>
  useQuery({
    queryKey: ['tasks', filters],
    queryFn: async () => (await api.get<Paginated<Task>>('/tasks', { params: { ...filters, include_done: filters.include_done ? 1 : undefined } })).data.data,
  });

export const useTask = (id: number | string | undefined) =>
  useQuery({
    queryKey: ['task', Number(id)],
    queryFn: async () => (await api.get<{ data: Task }>(`/tasks/${id}`)).data.data,
    enabled: !!id,
  });

export const useComments = (taskId: number) =>
  useQuery({
    queryKey: ['task', taskId, 'comments'],
    queryFn: async () => (await api.get<{ data: Comment[] }>(`/tasks/${taskId}/comments`)).data.data,
  });

export const useProjects = () =>
  useQuery({
    queryKey: ['projects'],
    queryFn: async () => (await api.get<{ data: Project[] }>('/projects')).data.data,
  });

export const useProject = (id: number | string | undefined) =>
  useQuery({
    queryKey: ['projects', Number(id)],
    queryFn: async () => (await api.get<{ data: Project }>(`/projects/${id}`)).data.data,
    enabled: !!id,
  });

export const useBoard = (projectId: number | string | undefined, params: Record<string, unknown>) =>
  useQuery({
    queryKey: ['board', Number(projectId), params],
    queryFn: async () => (await api.get<{ data: Task[] }>(`/projects/${projectId}/tasks`, { params })).data.data,
    enabled: !!projectId,
  });

export const useMembers = (projectId: number | undefined) =>
  useQuery({
    queryKey: ['projects', projectId, 'members'],
    queryFn: async () => (await api.get<{ data: UserSummary[] }>(`/projects/${projectId}/members`)).data.data,
    enabled: !!projectId,
  });

export const useNotifications = () =>
  useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<{ data: AppNotification[]; unread: number }>('/notifications')).data,
    refetchInterval: 60_000,
  });

export const useRun = (id: number | string | undefined) =>
  useQuery({
    queryKey: ['runs', Number(id)],
    queryFn: async () => (await api.get<{ data: Run }>(`/runs/${id}`)).data.data,
    enabled: !!id,
  });

export type Dashboard = { counts: { open: number; overdue: number; due_today: number; due_this_week: number; to_review: number; completed_this_week: number } };

export const useDashboard = () =>
  useQuery({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get<Dashboard>('/dashboard')).data,
  });
