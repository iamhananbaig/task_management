import * as React from "react"

/** Ref for the element a Combobox popup is anchored to. */
export function useComboboxAnchor() {
  return React.useRef<HTMLDivElement | null>(null)
}
