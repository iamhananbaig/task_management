import * as React from "react"

/** Whether the key press happened while typing in a field, where shortcuts must not fire. */
function typing(event: KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null
  return (
    target !== null &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  )
}

/**
 * A single-key shortcut for the page (e.g. "n" for a new receipt). Ignored while typing, with a
 * modifier held, or while a dialog is open.
 */
export function useShortcut(key: string, onPress: () => void, enabled = true) {
  const handler = React.useRef(onPress)
  React.useEffect(() => {
    handler.current = onPress
  })

  React.useEffect(() => {
    if (!enabled) return
    const onKey = (event: KeyboardEvent) => {
      if (
        event.key !== key ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        typing(event) ||
        document.querySelector('[role="dialog"]:not([data-slot="toast"]), [role="alertdialog"]:not([data-slot="toast"])')
      ) {
        return
      }
      event.preventDefault()
      handler.current()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [key, enabled])
}
