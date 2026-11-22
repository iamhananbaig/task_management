import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { TrashIcon } from "@phosphor-icons/react"

import { PageHeader } from "@/components/app/app-layout"
import { ErrorAlert, Loading } from "@/components/app/shared"
import { SearchableSelect } from "@/components/app/searchable-select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { ColorPicker } from "@/features/projects/components/ColorPicker"
import { WorkflowEditor } from "@/features/projects/components/WorkflowEditor"
import { UserName } from "@/features/tasks/components/badges"
import { api } from "@/lib/api"
import { useAuth, useCan } from "@/lib/auth"
import { fieldErrors } from "@/lib/errors"
import { Permission } from "@/lib/permissions"
import { useProject, useUserOptions, useWorkflow } from "@/lib/queries"
import { toast } from "@/lib/toast"
import type { Project } from "@/lib/types"

export default function ProjectSettingsPage() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const project = useProject(id)
  const tab = params.get("tab") ?? "details"

  if (project.isLoading) return <Loading />
  if (project.error || !project.data) return <ErrorAlert error={project.error ?? "Project not found."} />
  const p = project.data
  if (!p.can?.manage) return <ErrorAlert error="Only the project's managers can change its settings." />

  return (
    <>
      <PageHeader title={`${p.name} · Settings`} back={{ to: `/projects/${p.id}`, label: p.name }} />
      <Tabs value={tab} onValueChange={(value) => setParams({ tab: String(value) }, { replace: true })}>
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="members">Members ({p.members?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="workflow">Workflow</TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="max-w-xl pt-4">
          <DetailsForm project={p} />
        </TabsContent>
        <TabsContent value="members" className="max-w-2xl pt-4">
          <Members project={p} />
        </TabsContent>
        <TabsContent value="workflow" className="max-w-4xl pt-4">
          <WorkflowTab project={p} />
        </TabsContent>
      </Tabs>
    </>
  )
}

function DetailsForm({ project }: { project: Project }) {
  const navigate = useNavigate()
  const [name, setName] = React.useState(project.name)
  const [key, setKey] = React.useState(project.key)
  const [description, setDescription] = React.useState(project.description ?? "")
  const [color, setColor] = React.useState(project.color)
  const [restricted, setRestricted] = React.useState(project.is_restricted)
  const [escalate, setEscalate] = React.useState(project.escalate_after_days === null ? "" : String(project.escalate_after_days))
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  const save = useMutation({
    mutationFn: async () =>
      api.put(`/projects/${project.id}`, {
        name,
        key,
        description: description || null,
        color,
        is_restricted: restricted,
        escalate_after_days: escalate ? Number(escalate) : null,
      }),
    onSuccess: () => toast.success("Project saved"),
  })
  const archive = useMutation({
    mutationFn: async () => api.post(`/projects/${project.id}/${project.archived_at ? "unarchive" : "archive"}`),
    onSuccess: () => toast.success(project.archived_at ? "Project unarchived" : "Project archived"),
  })
  const remove = useMutation({
    mutationFn: async () => api.delete(`/projects/${project.id}`),
    onSuccess: () => {
      toast.success("Project deleted")
      navigate("/projects")
    },
  })
  const errors = fieldErrors(save.error)

  return (
    <div className="flex flex-col gap-8">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          save.mutate()
        }}
      >
        <FieldGroup>
          <Field data-invalid={!!errors.name || undefined}>
            <FieldLabel htmlFor="settings-name">Name</FieldLabel>
            <Input id="settings-name" value={name} onChange={(event) => setName(event.target.value)} required />
            <FieldError>{errors.name?.[0]}</FieldError>
          </Field>
          <Field data-invalid={!!errors.key || undefined}>
            <FieldLabel htmlFor="settings-key">Key</FieldLabel>
            <Input id="settings-key" className="w-32 font-mono uppercase" value={key} maxLength={10} onChange={(event) => setKey(event.target.value.toUpperCase())} required />
            <FieldError>{errors.key?.[0] ?? (key !== project.key ? "Changing the key renumbers every task reference (e.g. in old emails)." : undefined)}</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="settings-description">Description</FieldLabel>
            <Textarea id="settings-description" rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Colour</FieldLabel>
            <ColorPicker value={color} onChange={setColor} />
          </Field>
          <Field data-invalid={!!errors.escalate_after_days || undefined}>
            <FieldLabel htmlFor="settings-escalate">Escalate overdue tasks to managers after</FieldLabel>
            <NativeSelect id="settings-escalate" className="w-48" value={escalate} onChange={(event) => setEscalate(event.target.value)}>
              <NativeSelectOption value="">Never</NativeSelectOption>
              {[1, 2, 3, 5, 7, 10, 14].map((days) => (
                <NativeSelectOption key={days} value={days}>
                  {days} day{days > 1 ? "s" : ""} overdue
                </NativeSelectOption>
              ))}
            </NativeSelect>
            <FieldDescription>The project's managers get one notice per task (the assignee already gets the overdue reminder).</FieldDescription>
          </Field>
          <div className="flex items-start gap-2.5">
            <Switch id="settings-restricted" checked={restricted} onCheckedChange={setRestricted} />
            <Label htmlFor="settings-restricted" className="flex flex-col items-start gap-0.5">
              <span>Restricted project</span>
              <span className="text-xs font-normal text-muted-foreground">
                Only members and people with “view restricted projects” see it and its tasks — e.g. payroll. Others who see all projects won't.
              </span>
            </Label>
          </div>
          <div>
            <Button type="submit" size="lg" disabled={save.isPending}>
              {save.isPending && <Spinner />} Save
            </Button>
          </div>
        </FieldGroup>
      </form>

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold">{project.archived_at ? "Archived" : "Archive"}</h2>
        <p className="text-sm text-muted-foreground">
          {project.archived_at
            ? "The project is hidden from the projects list and its tasks are read-only."
            : "Hides the project and makes its tasks read-only. Nothing is deleted; you can unarchive at any time."}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => archive.mutate()} disabled={archive.isPending}>
            {project.archived_at ? "Unarchive" : "Archive project"}
          </Button>
          {project.can?.delete && (
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              <TrashIcon /> Delete project
            </Button>
          )}
        </div>
      </section>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {project.name}?</AlertDialogTitle>
            <AlertDialogDescription>Only a project with no tasks (also none in the bin) can be deleted. Archive it otherwise.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => remove.mutate()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Members({ project }: { project: Project }) {
  const { user } = useAuth()
  const users = useUserOptions()
  const [adding, setAdding] = React.useState("")
  const [role, setRole] = React.useState<"member" | "manager">("member")
  const save = useMutation({
    mutationFn: async ({ userId, role: nextRole }: { userId: number; role: string }) => api.post(`/projects/${project.id}/members`, { user_id: userId, role: nextRole }),
    onSuccess: () => setAdding(""),
  })
  const remove = useMutation({ mutationFn: async (userId: number) => api.delete(`/projects/${project.id}/members/${userId}`) })

  const memberIds = new Set(project.members?.map((member) => member.id))
  const candidates = (users.data ?? []).filter((option) => !memberIds.has(option.id))

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Members see the project and can be assignees or reviewers. Managers also change its settings, members and workflow.</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field className="w-64 flex-1">
          <FieldLabel htmlFor="add-member">Add a person</FieldLabel>
          <SearchableSelect id="add-member" items={candidates.map((option) => ({ value: String(option.id), label: `${option.name} · ${option.email}` }))} value={adding} onChange={setAdding} placeholder="Type a name…" />
        </Field>
        <NativeSelect value={role} onChange={(event) => setRole(event.target.value as "member" | "manager")} aria-label="Role" className="mb-px">
          <NativeSelectOption value="member">Member</NativeSelectOption>
          <NativeSelectOption value="manager">Manager</NativeSelectOption>
        </NativeSelect>
        <Button disabled={!adding || save.isPending} onClick={() => save.mutate({ userId: Number(adding), role })}>
          Add
        </Button>
      </div>
      <ul className="divide-y rounded-lg border">
        {project.members?.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <UserName user={member} />
              <div className="truncate pl-7.5 text-xs text-muted-foreground">{member.email}</div>
            </div>
            <NativeSelect value={member.project_role ?? "member"} onChange={(event) => save.mutate({ userId: member.id, role: event.target.value })} aria-label={`Role of ${member.name}`}>
              <NativeSelectOption value="member">Member</NativeSelectOption>
              <NativeSelectOption value="manager">Manager</NativeSelectOption>
            </NativeSelect>
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${member.name}`} disabled={member.id === user?.id && member.project_role === "manager"} onClick={() => remove.mutate(member.id)}>
              <TrashIcon />
            </Button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">Removing someone unassigns them from the project's open tasks.</p>
    </div>
  )
}

function WorkflowTab({ project }: { project: Project }) {
  const workflow = useWorkflow(project.id)
  const canTemplate = useCan(Permission.ManageWorkflowTemplates)
  const [saving, setSaving] = React.useState(false)
  const [name, setName] = React.useState("")
  const saveTemplate = useMutation({
    mutationFn: async () => api.post(`/projects/${project.id}/workflow/save-as-template`, { name }),
    onSuccess: () => {
      toast.success("Template saved", `New projects can now start from "${name}".`)
      setSaving(false)
      setName("")
    },
  })

  if (workflow.isLoading) return <Loading />
  if (!workflow.data) return <ErrorAlert error={workflow.error} />

  return (
    <>
      {canTemplate && (
        <div className="mb-4 flex justify-end">
          <Button variant="outline" onClick={() => setSaving(true)}>
            Save as template
          </Button>
        </div>
      )}
      <WorkflowEditor projectId={project.id} statuses={workflow.data.statuses} transitions={workflow.data.transitions} />
      <Dialog open={saving} onOpenChange={setSaving}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save the workflow as a template</DialogTitle>
          </DialogHeader>
          <Field data-invalid={!!fieldErrors(saveTemplate.error).name || undefined}>
            <FieldLabel htmlFor="template-name">Template name</FieldLabel>
            <Input id="template-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} />
            <FieldError>{fieldErrors(saveTemplate.error).name?.[0]}</FieldError>
          </Field>
          <p className="text-xs text-muted-foreground">Saves the workflow as last saved (not unsaved edits).</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaving(false)}>
              Cancel
            </Button>
            <Button disabled={!name.trim() || saveTemplate.isPending} onClick={() => saveTemplate.mutate()}>
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
