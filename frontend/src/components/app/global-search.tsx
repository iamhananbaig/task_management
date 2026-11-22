import * as React from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate } from "react-router-dom"
import { MagnifyingGlassIcon } from "@phosphor-icons/react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { ColorDot, StatusBadge } from "@/features/tasks/components/badges"
import { useDebounced } from "@/hooks/use-debounced"
import { api } from "@/lib/api"
import type { Status } from "@/lib/types"
import { cn } from "@/lib/utils"

type SearchResponse = {
  tasks: { id: number; reference: string; title: string; project: { id: number; name: string; color: string }; status: Pick<Status, "id" | "name" | "color" | "type"> }[]
  projects: { id: number; name: string; key: string; color: string; archived_at: string | null }[]
}

type Result = { key: string; to: string; render: React.ReactNode }

const pages: { title: string; to: string }[] = [
  { title: "Dashboard", to: "/" },
  { title: "My tasks", to: "/my-tasks" },
  { title: "To review", to: "/my-tasks?tab=review" },
  { title: "Projects", to: "/projects" },
  { title: "Notifications", to: "/notifications" },
]

/** Top-bar search (Ctrl+K): tasks by title or number (WEB-12), projects, and pages. */
export function GlobalSearch() {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search (Ctrl K)"
        className="flex h-8 items-center gap-2 rounded-md border bg-background px-2.5 text-left text-sm text-muted-foreground hover:border-ring sm:w-full sm:max-w-md"
      >
        <MagnifyingGlassIcon className="size-4 shrink-0" />
        <span className="hidden flex-1 truncate sm:block">Search tasks and projects…</span>
        <kbd className="hidden rounded border px-1 font-mono text-[0.65rem] sm:inline">Ctrl K</kbd>
      </button>
      {open && <SearchDialog onClose={() => setOpen(false)} />}
    </>
  )
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const [text, setText] = React.useState("")
  const [active, setActive] = React.useState(0)
  const query = useDebounced(text.trim(), 200)
  const search = useQuery({
    queryKey: ["search", query],
    queryFn: async () => (await api.get<SearchResponse>("/search", { params: { q: query } })).data,
    enabled: query.length >= 2,
  })

  const results: Result[] = [
    ...(search.data?.tasks ?? []).map((task) => ({
      key: `t${task.id}`,
      to: `/tasks/${task.id}`,
      render: (
        <>
          <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">{task.reference}</span>
          <span className="min-w-0 flex-1 truncate">{task.title}</span>
          <StatusBadge status={task.status} />
        </>
      ),
    })),
    ...(search.data?.projects ?? []).map((project) => ({
      key: `p${project.id}`,
      to: `/projects/${project.id}`,
      render: (
        <>
          <ColorDot color={project.color} />
          <span className="min-w-0 flex-1 truncate">{project.name}</span>
          <span className="font-mono text-xs text-muted-foreground">{project.key}</span>
        </>
      ),
    })),
    ...pages
      .filter((page) => text.trim() && page.title.toLowerCase().includes(text.trim().toLowerCase()))
      .map((page) => ({ key: page.to, to: page.to, render: <span className="flex-1">Go to {page.title}</span> })),
  ]

  const go = (result: Result | undefined) => {
    if (!result) return
    onClose()
    navigate(result.to)
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="top-[15%] translate-y-0 gap-0 p-0 sm:max-w-xl" showCloseButton={false}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-2 border-b px-3">
          <MagnifyingGlassIcon className="size-4 text-muted-foreground" />
          <input
            autoFocus
            value={text}
            onChange={(event) => {
              setText(event.target.value)
              setActive(0)
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault()
                setActive((index) => Math.min(index + 1, results.length - 1))
              } else if (event.key === "ArrowUp") {
                event.preventDefault()
                setActive((index) => Math.max(index - 1, 0))
              } else if (event.key === "Enter") {
                go(results[active])
              }
            }}
            placeholder="Task title, WEB-12, project…"
            className="h-11 flex-1 bg-transparent text-sm outline-none"
            aria-label="Search"
          />
          {search.isFetching && <Spinner />}
        </div>
        <ul className="max-h-80 overflow-y-auto p-1" role="listbox">
          {results.map((result, index) => (
            <li key={result.key} role="option" aria-selected={index === active}>
              <button
                type="button"
                onMouseEnter={() => setActive(index)}
                onClick={() => go(result)}
                className={cn("flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm", index === active && "bg-muted")}
              >
                {result.render}
              </button>
            </li>
          ))}
          {query.length >= 2 && !search.isFetching && results.length === 0 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">Nothing found.</li>}
          {query.length < 2 && <li className="px-2 py-6 text-center text-sm text-muted-foreground">Type at least 2 characters.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
