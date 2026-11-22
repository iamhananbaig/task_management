import { Field, FieldLabel } from "@/components/ui/field"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { useUpdateTask } from "@/features/tasks/lib/use-update-task"
import { swatch } from "@/lib/labels"
import { useTagGroups } from "@/lib/queries"
import type { Task, TaskTag } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Small tag pills (cards, lists). */
export function TagChips({ tags, className }: { tags?: TaskTag[]; className?: string }) {
  if (!tags?.length) return null
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {tags.map((tag) => (
        <span key={tag.id} className={cn("inline-flex h-4.5 items-center rounded px-1.5 text-[0.65rem] font-medium", swatch(tag.color).badge)}>
          {tag.name}
        </span>
      ))}
    </span>
  )
}

/** One select per tag group (Entity, Branch, Cost centre…). Read-only pills without edit rights. */
export function TaskTags({ task }: { task: Task }) {
  const groups = useTagGroups()
  const update = useUpdateTask(task.id)
  const current = task.tags ?? []

  if (!task.can?.update) {
    return current.length ? (
      <div>
        <div className="mb-1 text-xs text-muted-foreground">Tags</div>
        <TagChips tags={current} />
      </div>
    ) : null
  }
  if (!groups.data?.length) return null

  const setGroup = (groupId: number, tagId: string) => {
    const others = current.filter((tag) => tag.tag_group_id !== groupId).map((tag) => tag.id)
    update.mutate({ tag_ids: tagId ? [...others, Number(tagId)] : others })
  }

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
      {groups.data.map((group) => {
        const selected = current.find((tag) => tag.tag_group_id === group.id)
        const id = `task-tag-${group.id}`
        return (
          <Field key={group.id}>
            <FieldLabel htmlFor={id}>{group.name}</FieldLabel>
            <NativeSelect id={id} className="w-full" value={selected ? String(selected.id) : ""} onChange={(event) => setGroup(group.id, event.target.value)}>
              <NativeSelectOption value="">—</NativeSelectOption>
              {group.tags
                .filter((tag) => tag.is_active || tag.id === selected?.id)
                .map((tag) => (
                  <NativeSelectOption key={tag.id} value={tag.id}>
                    {tag.name}
                    {!tag.is_active ? " (inactive)" : ""}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
          </Field>
        )
      })}
    </div>
  )
}
