import * as React from "react"
import { useLocation } from "react-router-dom"
import { PlusIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { NewTaskDialog } from "@/features/tasks/components/NewTaskDialog"
import { useProjects } from "@/lib/queries"
import { useShortcut } from "@/lib/shortcuts"

/**
 * "New task" in the top bar, and the N shortcut, on every page. A project page has its own button
 * and shortcut (that project preselected), so this one steps aside there.
 */
export function QuickAddTask() {
  const location = useLocation()
  const [open, setOpen] = React.useState(false)
  const projects = useProjects()
  const onProjectPage = /^\/projects\/\d+\/?$/.test(location.pathname)
  const canCreate = (projects.data ?? []).some((project) => project.can?.create_tasks)

  useShortcut("n", () => setOpen(true), canCreate && !onProjectPage)
  if (!canCreate || onProjectPage) return null

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)} aria-keyshortcuts="n" title="New task (N)">
        <PlusIcon /> <span className="max-sm:sr-only">New task</span>
      </Button>
      <NewTaskDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
