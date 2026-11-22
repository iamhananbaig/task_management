import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select"
import { useTagGroups } from "@/lib/queries"

/** "Any tag" select grouped by tag group. Value is a tag id or "". */
export function TagFilter({ value, onChange, className }: { value: string; onChange: (value: string) => void; className?: string }) {
  const groups = useTagGroups()
  if (!groups.data?.length) return null
  return (
    <NativeSelect className={className} value={value} onChange={(event) => onChange(event.target.value)} aria-label="Tag">
      <NativeSelectOption value="">Any tag</NativeSelectOption>
      {groups.data.map((group) => (
        <NativeSelectOptGroup key={group.id} label={group.name}>
          {group.tags.map((tag) => (
            <NativeSelectOption key={tag.id} value={tag.id}>
              {tag.name}
            </NativeSelectOption>
          ))}
        </NativeSelectOptGroup>
      ))}
    </NativeSelect>
  )
}
