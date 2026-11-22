import * as React from "react"
import { useSearchParams } from "react-router-dom"
import { PlusIcon } from "@phosphor-icons/react"

import { PageHeader } from "@/components/app/app-layout"
import { EmptyState, ErrorAlert, Loading } from "@/components/app/shared"
import { Button } from "@/components/ui/button"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { NewProjectDialog } from "@/features/projects/components/ProjectFormDialog"
import { ProjectCard } from "@/features/projects/components/ProjectCard"
import { useCan } from "@/lib/auth"
import { Permission } from "@/lib/permissions"
import { useProjects } from "@/lib/queries"
import { useShortcut } from "@/lib/shortcuts"

export default function ProjectsPage() {
  const [params, setParams] = useSearchParams()
  const archived = params.get("archived") === "1"
  const projects = useProjects(archived)
  const canCreate = useCan(Permission.ManageProjects)
  const [creating, setCreating] = React.useState(false)
  useShortcut("n", () => setCreating(true), canCreate)

  return (
    <>
      <PageHeader title="Projects" description="Projects you belong to. Open one to see its board.">
        <ToggleGroup
          value={[archived ? "archived" : "active"]}
          onValueChange={(value) => value[0] && setParams(value[0] === "archived" ? { archived: "1" } : {})}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="active">Active</ToggleGroupItem>
          <ToggleGroupItem value="archived">Archived</ToggleGroupItem>
        </ToggleGroup>
        {canCreate && (
          <Button onClick={() => setCreating(true)}>
            <PlusIcon /> New project
          </Button>
        )}
      </PageHeader>

      <ErrorAlert error={projects.error} />
      {projects.isLoading && <Loading />}
      {projects.data?.length === 0 && (
        <EmptyState
          title={archived ? "No archived projects" : "No projects yet"}
          description={archived ? undefined : canCreate ? "Create the first project to start adding tasks." : "Ask a manager to add you to a project."}
          action={!archived && canCreate ? <Button onClick={() => setCreating(true)}><PlusIcon /> New project</Button> : undefined}
        />
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {projects.data?.map((project) => <ProjectCard key={project.id} project={project} />)}
      </div>

      {canCreate && <NewProjectDialog open={creating} onOpenChange={setCreating} />}
    </>
  )
}
