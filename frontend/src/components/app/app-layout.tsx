import * as React from "react"
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom"
import { Loading } from "@/components/app/shared"
import {
  ArrowLeftIcon,
  BellIcon,
  ChartBarIcon,
  CheckSquareOffsetIcon,
  ClockCounterClockwiseIcon,
  FlowArrowIcon,
  FoldersIcon,
  HouseIcon,
  KeyIcon,
  MoonIcon,
  ShieldCheckIcon,
  SignOutIcon,
  SunIcon,
  TagIcon,
  TrashIcon,
  UsersIcon,
} from "@phosphor-icons/react"

import { ChangePasswordDialog, ChangePasswordScreen } from "@/components/app/change-password"
import { GlobalSearch } from "@/components/app/global-search"
import { NotificationBell } from "@/components/app/notification-bell"
import { QuickAddTask } from "@/features/tasks/components/QuickAddTask"
import { Button } from "@/components/ui/button"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useSidebar } from "@/components/ui/sidebar-context";
import { useTheme } from "@/components/theme-context";
import { useAuth } from "@/lib/auth"
import { helpFor } from "@/lib/help"
import { Permission } from "@/lib/permissions"
import { useShortcut } from "@/lib/shortcuts"

type NavItem = {
  to: string
  label: string
  icon: React.ComponentType
  /** Hidden unless the user holds at least one of these permissions. */
  anyOf?: string[]
}

type NavGroup = { label: string; items: NavItem[] }

const navigation: NavGroup[] = [
  {
    label: "Work",
    items: [
      { to: "/", label: "Dashboard", icon: HouseIcon },
      { to: "/my-tasks", label: "My tasks", icon: CheckSquareOffsetIcon },
      { to: "/projects", label: "Projects", icon: FoldersIcon },
      { to: "/notifications", label: "Notifications", icon: BellIcon },
      { to: "/bin", label: "Bin", icon: TrashIcon, anyOf: [Permission.DeleteTasks] },
    ],
  },
  {
    label: "Insights",
    items: [{ to: "/reports", label: "Reports", icon: ChartBarIcon, anyOf: [Permission.ViewReports] }],
  },
  {
    label: "Admin",
    items: [
      { to: "/tags", label: "Tags", icon: TagIcon, anyOf: [Permission.ManageTags] },
      { to: "/workflow-templates", label: "Workflow templates", icon: FlowArrowIcon, anyOf: [Permission.ManageWorkflowTemplates] },
      { to: "/users", label: "Users", icon: UsersIcon, anyOf: [Permission.ViewUsers] },
      { to: "/roles", label: "Roles", icon: ShieldCheckIcon, anyOf: [Permission.ViewRoles] },
      { to: "/audit-log", label: "Audit log", icon: ClockCounterClockwiseIcon, anyOf: [Permission.ViewAuditLog] },
    ],
  },
]

const allItems = navigation.flatMap((group) => group.items)

function isActiveLink(item: NavItem, pathname: string): boolean {
  if (item.to === "/") return pathname === "/"
  if (pathname === item.to) return true
  return pathname.startsWith(item.to + "/") && !allItems.some((other) => other.to.startsWith(item.to + "/") && pathname.startsWith(other.to))
}

function currentItem(pathname: string): NavItem | undefined {
  return allItems.find((item) => isActiveLink(item, pathname))
}

/** True when the user may open this nav item (no restriction = everyone). */
function useAllowed() {
  const { can } = useAuth()
  return (item: NavItem) => !item.anyOf || item.anyOf.some((p) => can(p))
}

export function AppLayout() {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (user?.must_change_password) {
    return <ChangePasswordScreen />
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0">
        <TopBar />
        <main className="min-w-0 flex-1 px-4 py-4 md:px-6 md:py-6">
          {/* Permissions arrive with /user; until then render nothing rather than flash "no access" */}
          {user?.permissions ? <RouteGuard /> : null}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

/** Blocks direct navigation to a section the user's role cannot see. */
function RouteGuard() {
  const location = useLocation()
  const allowed = useAllowed()
  const item = currentItem(location.pathname)

  if (item && !allowed(item)) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-lg font-semibold">No access</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your role does not include this section. Ask an administrator if you need it.
        </p>
      </div>
    )
  }
  // Pages are loaded on demand: keep the sidebar and show a spinner while one loads
  return (
    <React.Suspense fallback={<Loading />}>
      <Outlet />
    </React.Suspense>
  )
}

function AppSidebar() {
  const { user, logout } = useAuth()
  const { setOpenMobile } = useSidebar()
  const location = useLocation()
  const allowed = useAllowed()
  const [changingPassword, setChangingPassword] = React.useState(false)

  const groups = navigation
    .map((group) => ({ ...group, items: group.items.filter(allowed) }))
    .filter((group) => group.items.length > 0)

  const roles = ((user as { roles?: { name: string }[] } | null)?.roles ?? []).map((r) => r.name)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
            <CheckSquareOffsetIcon weight="bold" className="size-4" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">Tasks</span>
            <span className="text-[0.65rem] text-muted-foreground">Team task management</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      isActive={isActiveLink(item, location.pathname)}
                      tooltip={item.label}
                      render={<NavLink to={item.to} onClick={() => setOpenMobile(false)} />}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="min-w-0 px-2 py-1 group-data-[collapsible=icon]:hidden">
          <div className="truncate text-xs font-medium">{user?.name}</div>
          <div className="truncate text-[0.65rem] text-muted-foreground capitalize">
            {roles.join(", ") || "No role"}
          </div>
          <div className="truncate text-[0.65rem] text-muted-foreground">{user?.email}</div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => setChangingPassword(true)} tooltip="Change password">
              <KeyIcon />
              <span>Change password</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => logout()} tooltip="Sign out">
              <SignOutIcon />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <ChangePasswordDialog open={changingPassword} onOpenChange={setChangingPassword} />
      </SidebarFooter>
    </Sidebar>
  )
}

function TopBar() {
  const { theme, setTheme } = useTheme()
  const location = useLocation()
  const section = currentItem(location.pathname)?.label

  // Browser tab: "Projects · Tasks"
  React.useEffect(() => {
    document.title = section ? `${section} · Tasks` : "Tasks"
  }, [section])
  const isDark =
    theme === "dark" ||
    (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)

  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur">
      <SidebarTrigger />
      <span className="truncate text-sm font-semibold md:hidden">
        {currentItem(location.pathname)?.label ?? "Tasks"}
      </span>
      <div className="flex flex-1 justify-center px-2">
        <GlobalSearch />
      </div>
      <QuickAddTask />
      <NotificationBell />
      <Button
        variant="ghost"
        size="icon"
        aria-label="Toggle theme"
        onClick={() => setTheme(isDark ? "light" : "dark")}
      >
        {isDark ? <SunIcon /> : <MoonIcon />}
      </Button>
    </header>
  )
}

/** Page title, description, actions and the "?" note for the screen. */
export function PageHeader({
  title,
  description,
  back,
  children,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  /** Back link shown above the title on detail pages. */
  back?: { to: string; label: string }
  children?: React.ReactNode
}) {
  const location = useLocation()
  const help = helpFor(location.pathname)
  const [helpOpen, setHelpOpen] = React.useState(false)
  useShortcut("?", () => setHelpOpen((open) => !open), Boolean(help))

  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link
            to={back.to}
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-3" /> {back.label}
          </Link>
        )}
        <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          {title}
          {help && (
            <button
              type="button"
              aria-expanded={helpOpen}
              aria-label="How this screen works"
              title="How this screen works (?)"
              className="flex size-5 items-center justify-center rounded-full border text-xs font-medium text-muted-foreground hover:text-foreground"
              onClick={() => setHelpOpen(!helpOpen)}
            >
              ?
            </button>
          )}
        </h1>
        {description && <p className="mt-0.5 max-w-3xl text-sm text-muted-foreground">{description}</p>}
        {help && helpOpen && (
          <ul className="mt-2 max-w-3xl list-disc space-y-0.5 rounded-md border bg-muted/40 py-2 pr-3 pl-7 text-sm">
            {help.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}
