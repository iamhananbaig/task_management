import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { api, apiErrorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"
import { toast } from "@/lib/toast"

/** Current password + new password twice. Calls PUT /user/password. */
function ChangePasswordForm({ onDone, submitLabel = "Change password" }: { onDone?: () => void; submitLabel?: string }) {
  const { setCurrentUser } = useAuth()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (next !== confirm) {
      setError("The new passwords do not match.")
      return
    }
    setBusy(true)
    try {
      const res = await api.put("/user/password", {
        current_password: current,
        password: next,
        password_confirmation: confirm,
      })
      setCurrentUser(res.data)
      toast.success("Password changed", "Other sessions were signed out.")
      onDone?.()
    } catch (err) {
      setError(apiErrorMessage(err, "Could not change the password"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit}>
      <FieldGroup>
        {error && <p className="rounded-md bg-destructive/10 p-2.5 text-sm text-destructive">{error}</p>}
        <Field>
          <FieldLabel htmlFor="current-password">Current password</FieldLabel>
          <Input id="current-password" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus />
        </Field>
        <Field>
          <FieldLabel htmlFor="new-password">New password</FieldLabel>
          <Input id="new-password" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={10} />
          <FieldDescription>At least 10 characters, with letters and numbers.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirm-password">Repeat new password</FieldLabel>
          <Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <Spinner />} {submitLabel}
        </Button>
      </FieldGroup>
    </form>
  )
}

/** Full-screen step shown instead of the app until the user replaces a temporary/default password. */
export function ChangePasswordScreen() {
  const { user, logout } = useAuth()
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <h1 className="text-lg font-semibold">Set a new password</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {user?.name ? `${user.name}, your` : "Your"} password was set by an administrator or is a default one.
          Choose your own before continuing.
        </p>
        <ChangePasswordForm submitLabel="Save and continue" />
        <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => logout()}>
          Sign out
        </Button>
      </div>
    </div>
  )
}

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>Other devices signed in to your account are signed out.</DialogDescription>
        </DialogHeader>
        {open && <ChangePasswordForm onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}
