import * as React from "react"
import { useMutation } from "@tanstack/react-query"
import { PlusIcon, TrashIcon } from "@phosphor-icons/react"

import { PageHeader } from "@/components/app/app-layout"
import { EmptyState, ErrorAlert, Loading } from "@/components/app/shared"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Switch } from "@/components/ui/switch"
import { api } from "@/lib/api"
import { useCan } from "@/lib/auth"
import { colorNames, swatch } from "@/lib/labels"
import { Permission } from "@/lib/permissions"
import { useTagGroups } from "@/lib/queries"
import type { TagGroup } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Tag groups (Entity, Branch, Cost centre…) and their values. A task has at most one tag per group. */
export default function TagsPage() {
  const groups = useTagGroups()
  const canManage = useCan(Permission.ManageTags)
  const [name, setName] = React.useState("")
  const addGroup = useMutation({ mutationFn: async () => api.post("/tag-groups", { name }), onSuccess: () => setName("") })

  return (
    <>
      <PageHeader title="Tags" description="Group tasks by entity, branch, cost centre or anything else. Filter lists, boards and reports by them. Tags in use can be made inactive but not deleted." />
      {canManage && (
        <form
          className="mb-6 flex max-w-md gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim()) addGroup.mutate()
          }}
        >
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="New group, e.g. Branch" aria-label="New tag group" />
          <Button type="submit" disabled={!name.trim() || addGroup.isPending}>
            <PlusIcon /> Add group
          </Button>
        </form>
      )}
      <ErrorAlert error={groups.error} />
      {groups.isLoading && <Loading />}
      {groups.data?.length === 0 && <EmptyState title="No tag groups yet" description="Start with Entity, Branch or Cost centre." />}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {groups.data?.map((group) => <GroupCard key={group.id} group={group} canManage={canManage} />)}
      </div>
    </>
  )
}

function GroupCard({ group, canManage }: { group: TagGroup; canManage: boolean }) {
  const [name, setName] = React.useState("")
  const add = useMutation({ mutationFn: async () => api.post(`/tag-groups/${group.id}/tags`, { name }), onSuccess: () => setName("") })
  const update = useMutation({ mutationFn: async ({ id, ...patch }: { id: number; color?: string; is_active?: boolean }) => api.put(`/tags/${id}`, patch) })
  const remove = useMutation({ mutationFn: async (id: number) => api.delete(`/tags/${id}`) })
  const removeGroup = useMutation({ mutationFn: async () => api.delete(`/tag-groups/${group.id}`) })

  return (
    <section className="rounded-lg border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="flex-1 font-semibold">{group.name}</h2>
        {canManage && (
          <Button variant="ghost" size="icon-sm" aria-label={`Delete group ${group.name}`} onClick={() => removeGroup.mutate()}>
            <TrashIcon />
          </Button>
        )}
      </div>
      <ul className="flex flex-col divide-y">
        {group.tags.map((tag) => (
          <li key={tag.id} className="flex items-center gap-2 py-1.5">
            <span className={cn("inline-flex h-5 items-center rounded px-1.5 text-xs font-medium", swatch(tag.color).badge, !tag.is_active && "opacity-50")}>{tag.name}</span>
            {!tag.is_active && <span className="text-xs text-muted-foreground">inactive</span>}
            {canManage && (
              <div className="ml-auto flex items-center gap-2">
                <NativeSelect size="sm" value={tag.color} onChange={(event) => update.mutate({ id: tag.id, color: event.target.value })} aria-label={`Colour of ${tag.name}`}>
                  {colorNames.map((color) => (
                    <NativeSelectOption key={color} value={color}>
                      {color}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Switch size="sm" checked={tag.is_active} onCheckedChange={(checked) => update.mutate({ id: tag.id, is_active: checked })} aria-label={`${tag.name} in use`} />
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${tag.name}`} onClick={() => remove.mutate(tag.id)}>
                  <TrashIcon />
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {canManage && (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (name.trim()) add.mutate()
          }}
        >
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={`Add to ${group.name}`} aria-label={`New ${group.name} tag`} />
          <Button type="submit" variant="outline" disabled={!name.trim() || add.isPending}>
            Add
          </Button>
        </form>
      )}
    </section>
  )
}
