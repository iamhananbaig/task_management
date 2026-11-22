import { useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { CheckSquareOffsetIcon } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { apiErrorMessage } from "@/lib/api"
import { useAuth } from "@/lib/auth"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? "/"

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError("")
    setBusy(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(apiErrorMessage(err, "Sign-in failed"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <CheckSquareOffsetIcon weight="bold" className="size-4" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">Tasks</div>
            <div className="text-xs text-muted-foreground">Team task management</div>
          </div>
        </div>
        <h1 className="text-lg font-semibold">Sign in</h1>
        <p className="mb-4 text-sm text-muted-foreground">Use the account your administrator created for you.</p>
        <form onSubmit={handleSubmit}>
          <FieldGroup>
            {error && <p className="rounded-md bg-destructive/10 p-2.5 text-sm text-destructive">{error}</p>}
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email" type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </Field>
            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy && <Spinner />} Sign in
            </Button>
          </FieldGroup>
        </form>
      </div>
    </div>
  )
}
