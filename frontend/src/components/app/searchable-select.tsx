import { Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput, ComboboxContent, ComboboxEmpty, ComboboxInput, ComboboxItem, ComboboxList, ComboboxValue } from "@/components/ui/combobox";
import { useComboboxAnchor } from "@/components/ui/combobox-anchor";

export type SelectItem = { value: string; label: string }

/** Type-to-filter single select (base-ui Combobox). Value is the item's string value; "" = none. */
export function SearchableSelect({
  id,
  items,
  value,
  onChange,
  placeholder = "Select…",
  disabled,
}: {
  id?: string
  items: SelectItem[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const selected = items.find((item) => String(item.value) === String(value)) ?? null

  return (
    <Combobox
      autoHighlight
      items={items}
      value={selected}
      disabled={disabled}
      itemToStringLabel={(item: SelectItem) => item.label}
      isItemEqualToValue={(item: SelectItem, current: SelectItem) => item.value === current.value}
      onValueChange={(next: SelectItem | null) => onChange(next ? String(next.value) : "")}
    >
      <ComboboxInput id={id} placeholder={placeholder} className="w-full" />
      <ComboboxContent>
        <ComboboxEmpty>Nothing matches.</ComboboxEmpty>
        <ComboboxList>
          {(item: SelectItem) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}

/** Type-to-filter multi select with chips. */
export function SearchableMultiSelect({
  id,
  items,
  selectedIds,
  onChange,
  placeholder = "Select…",
  disabled,
}: {
  id?: string
  items: SelectItem[]
  selectedIds: string[]
  onChange: (ids: string[]) => void
  placeholder?: string
  disabled?: boolean
  /** Accepted for backwards compatibility; chips use the theme style. */
  badgeClassName?: string
}) {
  const anchor = useComboboxAnchor()
  const selected = items.filter((item) => selectedIds.map(String).includes(String(item.value)))

  return (
    <Combobox
      multiple
      autoHighlight
      items={items}
      value={selected}
      disabled={disabled}
      itemToStringLabel={(item: SelectItem) => item.label}
      isItemEqualToValue={(item: SelectItem, current: SelectItem) => item.value === current.value}
      onValueChange={(next: SelectItem[]) => onChange(next.map((item) => String(item.value)))}
    >
      <ComboboxChips ref={anchor}>
        <ComboboxValue>
          {(chosen: SelectItem[]) => (
            <>
              {chosen.map((item) => (
                <ComboboxChip key={item.value}>{item.label}</ComboboxChip>
              ))}
              <ComboboxChipsInput id={id} placeholder={chosen.length ? "" : placeholder} />
            </>
          )}
        </ComboboxValue>
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>Nothing matches.</ComboboxEmpty>
        <ComboboxList>
          {(item: SelectItem) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
