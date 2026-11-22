import * as React from "react"
import { useMutation, useQuery } from "@tanstack/react-query"

import { PageHeader } from "@/components/app/app-layout"
import { ErrorAlert, Loading } from "@/components/app/shared"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { api } from "@/lib/api"
import { useCan } from "@/lib/auth"
import { Permission } from "@/lib/permissions"
import { toast } from "@/lib/toast"

type Role = { id: number; name: string; users_count: number; permissions: string[]; locked: boolean }
type RolesResponse = { data: Role[]; groups: Record<string, string[]> }

const explain: Record<string, string> = {
  "view all projects": "See every project, not only the ones they belong to",
  "manage projects": "Create projects; edit, archive and manage members of projects they can see",
  "manage workflow templates": "Create and edit the workflows new projects start from",
  "create tasks": "Add tasks to projects they belong to",
  "edit tasks": "Change title, description, people, priority, dates and checklist",
  "delete tasks": "Move tasks to the bin and restore them",
  "comment on tasks": "Comment and attach files",
  "override workflow": "Make any defined move, even when not the assignee / reviewer",
  "view users": "See the user list",
  "manage users": "Create users, reset passwords, change roles, deactivate",
  "view roles": "See this page",
  "manage roles": "Change what each role can do",
  "view audit log": "See every recorded change",
}

export default function RolesPage() {
  const roles = useQuery({ queryKey: ["roles", "full"], queryFn: async () => (await api.get<RolesResponse>("/roles")).data })
  const [selected, setSelected] = React.useState<string | null>(null)

  if (roles.isLoading) return <Loading />
  if (!roles.data) return <ErrorAlert error={roles.error} />
  const role = roles.data.data.find((item) => item.name === selected) ?? roles.data.data[0]

  return (
    <>
      <PageHeader title="Roles" description="What each role may do across the app. Access to a project also needs membership (unless the role sees all projects)." />
      <Tabs value={role?.name} onValueChange={(value) => setSelected(String(value))}>
        <TabsList>
          {roles.data.data.map((item) => (
            <TabsTrigger key={item.id} value={item.name} className="capitalize">
              {item.name} ({item.users_count})
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {role && <RoleEditor key={role.id} role={role} groups={roles.data.groups} />}
    </>
  )
}

function RoleEditor({ role, groups }: { role: Role; groups: Record<string, string[]> }) {
  const canManage = useCan(Permission.ManageRoles) && !role.locked
  const [chosen, setChosen] = React.useState(new Set(role.permissions))
  const save = useMutation({
    mutationFn: async () => api.put(`/roles/${role.id}`, { permissions: [...chosen] }),
    onSuccess: () => toast.success("Permissions saved", `Role ${role.name}`),
  })
  const dirty = chosen.size !== role.permissions.length || role.permissions.some((name) => !chosen.has(name))

  return (
    <div className="mt-4 flex max-w-2xl flex-col gap-6">
      {role.locked && <p className="text-sm text-muted-foreground">The admin role always has every permission.</p>}
      {Object.entries(groups).map(([group, names]) => (
        <section key={group}>
          <h2 className="mb-2 text-sm font-semibold">{group}</h2>
          <ul className="flex flex-col gap-2.5">
            {names.map((name) => (
              <li key={name} className="flex items-start gap-2.5">
                <Checkbox
                  id={`perm-${name}`}
                  checked={chosen.has(name)}
                  disabled={!canManage}
                  onCheckedChange={(checked) =>
                    setChosen((current) => {
                      const next = new Set(current)
                      if (checked) next.add(name)
                      else next.delete(name)
                      return next
                    })
                  }
                />
                <Label htmlFor={`perm-${name}`} className="flex flex-col items-start gap-0">
                  <span className="capitalize">{name}</span>
                  <span className="text-xs font-normal text-muted-foreground">{explain[name]}</span>
                </Label>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {canManage && (
        <div>
          <Button size="lg" disabled={!dirty || save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Spinner />} Save permissions
          </Button>
        </div>
      )}
    </div>
  )
}
