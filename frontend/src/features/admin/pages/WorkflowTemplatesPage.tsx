import { useMutation } from "@tanstack/react-query"
import { ArrowRightIcon, StarIcon, TrashIcon } from "@phosphor-icons/react"

import { PageHeader } from "@/components/app/app-layout"
import { EmptyState, ErrorAlert, Loading } from "@/components/app/shared"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/features/tasks/components/badges"
import { api } from "@/lib/api"
import { useCan } from "@/lib/auth"
import { actorLabels } from "@/lib/labels"
import { Permission } from "@/lib/permissions"
import { useWorkflowTemplates } from "@/lib/queries"
import { toast } from "@/lib/toast"
import type { WorkflowTemplate } from "@/lib/types"

/** Workflows offered when creating a project. Made with "Save as template" in a project's Workflow tab. */
export default function WorkflowTemplatesPage() {
  const templates = useWorkflowTemplates()
  const canManage = useCan(Permission.ManageWorkflowTemplates)
  const makeDefault = useMutation({
    mutationFn: async (template: WorkflowTemplate) => api.put(`/workflow-templates/${template.id}`, { ...template, is_default: true }),
    onSuccess: (_data, template) => toast.success("Default template", template.name),
  })
  const remove = useMutation({ mutationFn: async (template: WorkflowTemplate) => api.delete(`/workflow-templates/${template.id}`) })

  return (
    <>
      <PageHeader
        title="Workflow templates"
        description="The statuses and moves a new project starts with. To make one, design the workflow in a project (Settings → Workflow) and choose Save as template."
      />
      <ErrorAlert error={templates.error ?? makeDefault.error ?? remove.error} />
      {templates.isLoading && <Loading />}
      {templates.data?.length === 0 && <EmptyState title="No templates" />}
      <div className="flex flex-col gap-3">
        {templates.data?.map((template) => {
          const names = Object.fromEntries(template.definition.statuses.map((status) => [status.key, status.name]))
          return (
            <section key={template.id} className="rounded-lg border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="font-semibold">{template.name}</h2>
                {template.is_default && <span className="rounded bg-primary/10 px-1.5 text-[0.7rem] font-semibold text-primary">Default</span>}
                {canManage && (
                  <div className="ml-auto flex gap-1">
                    {!template.is_default && (
                      <Button variant="outline" size="sm" onClick={() => makeDefault.mutate(template)}>
                        <StarIcon /> Make default
                      </Button>
                    )}
                    {!template.is_default && (
                      <Button variant="ghost" size="icon-sm" aria-label={`Delete ${template.name}`} onClick={() => remove.mutate(template)}>
                        <TrashIcon />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              {template.description && <p className="mb-3 text-sm text-muted-foreground">{template.description}</p>}
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                {template.definition.statuses.map((status, index) => (
                  <span key={status.key} className="flex items-center gap-1.5">
                    {index > 0 && <ArrowRightIcon className="size-3 text-muted-foreground" />}
                    <StatusBadge status={status} />
                  </span>
                ))}
              </div>
              <ul className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                {template.definition.transitions.map((transition, index) => (
                  <li key={index} className="text-muted-foreground">
                    <span className="font-medium text-foreground">{transition.label}</span>: {names[transition.from]} → {names[transition.to]} · {transition.actors.map((actor) => actorLabels[actor]).join(", ")}
                    {transition.requires_comment && " · comment required"}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </>
  )
}
