/** Spatie permission names (backend App\Support\Permissions). */
export const Permission = {
  ViewAllProjects: "view all projects",
  ViewRestrictedProjects: "view restricted projects",
  ManageTags: "manage tags",
  ViewReports: "view reports",
  ManageProjects: "manage projects",
  ManageWorkflowTemplates: "manage workflow templates",
  CreateTasks: "create tasks",
  EditTasks: "edit tasks",
  DeleteTasks: "delete tasks",
  Comment: "comment on tasks",
  OverrideWorkflow: "override workflow",
  ViewUsers: "view users",
  ManageUsers: "manage users",
  ViewRoles: "view roles",
  ManageRoles: "manage roles",
  ViewAuditLog: "view audit log",
} as const

export type PermissionName = (typeof Permission)[keyof typeof Permission]
