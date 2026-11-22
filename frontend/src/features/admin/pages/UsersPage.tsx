import * as React from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useTable } from "@tanstack/react-table"
import { MagnifyingGlassIcon, PlusIcon } from "@phosphor-icons/react"

import { PageHeader } from "@/components/app/app-layout"
import { DataTable } from "@/components/app/data-table"
import { columnHelper, features } from "@/components/app/data-table-columns"
import { ErrorAlert, Loading } from "@/components/app/shared"
import { tones } from "@/components/app/tones"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { useDebounced } from "@/hooks/use-debounced"
import { api } from "@/lib/api"
import { useAuth, useCan } from "@/lib/auth"
import { fieldErrors } from "@/lib/errors"
import { Permission } from "@/lib/permissions"
import { toast } from "@/lib/toast"
import { cn } from "@/lib/utils"

type UserRow = { id: number; name: string; email: string; is_active: boolean; role: string | null; must_change_password: boolean; created_at: string }

const helper = columnHelper<UserRow>()
const columns = helper.columns([
  helper.accessor("name", { header: "Name", meta: { mobile: "title" }, cell: (info) => <span className="font-medium">{info.getValue()}</span> }),
  helper.accessor("email", { header: "Email", meta: { mobile: "subtitle" } }),
  helper.accessor((row) => row.role ?? "", { id: "role", header: "Role", cell: (info) => <span className="capitalize">{info.getValue() || "—"}</span> }),
  helper.accessor((row) => (row.is_active ? (row.must_change_password ? 1 : 0) : 2), {
    id: "status",
    header: "Status",
    cell: (info) => {
      const row = info.row.original
      const [label, tone] = !row.is_active ? ["Deactivated", tones.muted] : row.must_change_password ? ["Must set password", tones.amber] : ["Active", tones.green]
      return <span className={cn("inline-flex h-5 items-center rounded px-1.5 text-[0.7rem] font-semibold", tone)}>{label}</span>
    },
  }),
])

const empty: UserRow[] = []

export default function UsersPage() {
  const [search, setSearch] = React.useState("")
  const debounced = useDebounced(search, 300)
  const canManage = useCan(Permission.ManageUsers)
  const [editing, setEditing] = React.useState<UserRow | "new" | null>(null)
  const users = useQuery({
    queryKey: ["users", debounced],
    queryFn: async () => (await api.get<{ data: UserRow[]; total: number }>("/users", { params: { search: debounced || undefined } })).data,
  })
  const table = useTable({ features, columns, data: users.data?.data ?? empty, getRowId: (row) => String(row.id), initialState: { pagination: { pageIndex: 0, pageSize: 50 } } })

  return (
    <>
      <PageHeader title="Users" description="Accounts are created here; there is no public sign-up. New users set their own password at first sign-in.">
        {canManage && (
          <Button onClick={() => setEditing("new")}>
            <PlusIcon /> New user
          </Button>
        )}
      </PageHeader>
      <div className="relative mb-4 w-full sm:w-72">
        <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search name or email" value={search} onChange={(event) => setSearch(event.target.value)} aria-label="Search users" />
      </div>
      <ErrorAlert error={users.error} />
      {users.isLoading ? <Loading /> : <DataTable table={table} total={users.data?.total} onRowClick={canManage ? (row) => setEditing(row) : undefined} />}
      {editing && <UserDialog user={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  )
}

function UserDialog({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const { user: me } = useAuth()
  const roles = useQuery({ queryKey: ["roles"], queryFn: async () => (await api.get<{ data: { name: string }[] }>("/roles")).data.data, retry: false })
  const [name, setName] = React.useState(user?.name ?? "")
  const [email, setEmail] = React.useState(user?.email ?? "")
  const [role, setRole] = React.useState(user?.role ?? "member")
  const [password, setPassword] = React.useState("")
  const [active, setActive] = React.useState(user?.is_active ?? true)

  const save = useMutation({
    mutationFn: async () =>
      user
        ? api.put(`/users/${user.id}`, { name, email, role, is_active: active, password: password || null })
        : api.post("/users", { name, email, role, password }),
    onSuccess: () => {
      toast.success(user ? "User saved" : "User created", user ? undefined : `Give ${name} the temporary password; they will be asked to change it.`)
      onClose()
    },
  })
  const errors = fieldErrors(save.error)
  const roleNames = roles.data?.map((item) => item.name) ?? ["admin", "manager", "member", "viewer"]

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{user ? user.name : "New user"}</DialogTitle>
          {user && <DialogDescription>{user.email}</DialogDescription>}
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate()
          }}
        >
          <FieldGroup>
            {save.error && !Object.keys(errors).length && <ErrorAlert error={save.error} />}
            <Field data-invalid={!!errors.name || undefined}>
              <FieldLabel htmlFor="user-name">Name</FieldLabel>
              <Input id="user-name" value={name} onChange={(event) => setName(event.target.value)} required />
              <FieldError>{errors.name?.[0]}</FieldError>
            </Field>
            <Field data-invalid={!!errors.email || undefined}>
              <FieldLabel htmlFor="user-email">Email</FieldLabel>
              <Input id="user-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <FieldError>{errors.email?.[0]}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="user-role">Role</FieldLabel>
              <NativeSelect id="user-role" className="w-full capitalize" value={role} onChange={(event) => setRole(event.target.value)}>
                {roleNames.map((name) => (
                  <NativeSelectOption key={name} value={name}>
                    {name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError>{errors.role?.[0]}</FieldError>
            </Field>
            <Field data-invalid={!!errors.password || undefined}>
              <FieldLabel htmlFor="user-password">{user ? "Reset password" : "Temporary password"}</FieldLabel>
              <Input id="user-password" type="text" autoComplete="off" value={password} onChange={(event) => setPassword(event.target.value)} required={!user} minLength={10} placeholder={user ? "Leave empty to keep" : ""} />
              <FieldDescription>At least 10 characters. They must replace it at their next sign-in{user ? "; they are signed out everywhere" : ""}.</FieldDescription>
              <FieldError>{errors.password?.[0]}</FieldError>
            </Field>
            {user && user.id !== me?.id && (
              <div className="flex items-center gap-2">
                <Switch id="user-active" checked={active} onCheckedChange={setActive} />
                <Label htmlFor="user-active">{active ? "Active" : "Deactivated — cannot sign in"}</Label>
              </div>
            )}
          </FieldGroup>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending && <Spinner />} {user ? "Save" : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
