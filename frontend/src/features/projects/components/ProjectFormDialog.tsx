import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"

import { SearchableMultiSelect } from "@/components/app/searchable-select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ColorPicker } from "@/features/projects/components/ColorPicker"
import { api } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { fieldErrors } from "@/lib/errors"
import { useUserOptions, useWorkflowTemplates } from "@/lib/queries"
import { toast } from "@/lib/toast"
import type { Project } from "@/lib/types"

/** "Website relaunch" → "WR"; one word → first 3 letters. */
function suggestKey(name: string): string {
  const words = name.toUpperCase().replace(/[^A-Z0-9 ]/g, "").split(/\s+/).filter(Boolean)
  if (words.length === 0) return ""
  const key = words.length === 1 ? words[0].slice(0, 3) : words.map((word) => word[0]).join("").slice(0, 5)
  return /^[A-Z]/.test(key) ? key : `P${key}`.slice(0, 5)
}

export function NewProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const templates = useWorkflowTemplates()
  const users = useUserOptions()
  const [name, setName] = React.useState("")
  const [key, setKey] = React.useState("")
  const [keyTouched, setKeyTouched] = React.useState(false)
  const [description, setDescription] = React.useState("")
  const [color, setColor] = React.useState("blue")
  const [templateId, setTemplateId] = React.useState("")
  const [memberIds, setMemberIds] = React.useState<string[]>([])

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post<{ data: Project }>("/projects", {
          name,
          key,
          description: description || null,
          color,
          workflow_template_id: templateId ? Number(templateId) : null,
          member_ids: memberIds.map(Number),
        })
      ).data.data,
    onSuccess: (project) => {
      toast.success("Project created", project.name)
      onOpenChange(false)
      navigate(`/projects/${project.id}`)
    },
  })
  const errors = fieldErrors(create.error)
  const defaultTemplate = templates.data?.find((template) => template.is_default)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>You become its manager. Members can be added now or later.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            create.mutate()
          }}
        >
          <FieldGroup>
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <Field data-invalid={!!errors.name || undefined}>
                <FieldLabel htmlFor="project-name">Name</FieldLabel>
                <Input
                  id="project-name"
                  autoFocus
                  required
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value)
                    if (!keyTouched) setKey(suggestKey(event.target.value))
                  }}
                />
                <FieldError>{errors.name?.[0]}</FieldError>
              </Field>
              <Field data-invalid={!!errors.key || undefined}>
                <FieldLabel htmlFor="project-key">Key</FieldLabel>
                <Input
                  id="project-key"
                  required
                  maxLength={10}
                  className="font-mono uppercase"
                  value={key}
                  onChange={(event) => {
                    setKeyTouched(true)
                    setKey(event.target.value.toUpperCase())
                  }}
                />
              </Field>
            </div>
            {errors.key?.[0] ? <FieldError>{errors.key[0]}</FieldError> : <FieldDescription className="-mt-3">Task numbers start with the key: {key || "KEY"}-1, {key || "KEY"}-2…</FieldDescription>}
            <Field>
              <FieldLabel htmlFor="project-description">Description</FieldLabel>
              <Textarea id="project-description" rows={2} value={description} onChange={(event) => setDescription(event.target.value)} />
            </Field>
            <Field>
              <FieldLabel>Colour</FieldLabel>
              <ColorPicker value={color} onChange={setColor} />
            </Field>
            <Field>
              <FieldLabel htmlFor="project-template">Workflow</FieldLabel>
              <NativeSelect id="project-template" className="w-full" value={templateId} onChange={(event) => setTemplateId(event.target.value)}>
                <NativeSelectOption value="">{defaultTemplate ? `${defaultTemplate.name} (default)` : "Default workflow"}</NativeSelectOption>
                {templates.data
                  ?.filter((template) => !template.is_default)
                  .map((template) => (
                    <NativeSelectOption key={template.id} value={template.id}>
                      {template.name}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
              <FieldDescription>Statuses and moves can be changed later in the project's settings.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="project-members">Members</FieldLabel>
              <SearchableMultiSelect
                id="project-members"
                items={(users.data ?? []).filter((option) => option.id !== user?.id).map((option) => ({ value: String(option.id), label: option.name }))}
                selectedIds={memberIds}
                onChange={setMemberIds}
                placeholder="Add people…"
              />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || !name.trim() || !key.trim()}>
              {create.isPending && <Spinner />} Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
