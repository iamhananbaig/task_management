import { toast as manager } from "@/components/ui/toast-manager";

/**
 * App-wide notifications (base-ui toast, same look as the other finance apps).
 * Kept sonner-shaped (`toast.success("…")`) so call sites stay one-liners.
 */
type Kind = "success" | "error" | "warning" | "info"

const show = (type: Kind) => (title: string, description?: string) =>
  manager.add({ title, description, type })

export const toast = {
  success: show("success"),
  error: show("error"),
  warning: show("warning"),
  info: show("info"),
}
