"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction, loginAction, resetPasswordAction } from "@/app/admin/_actions/auth";
import { CheckboxField, FormAlert, PasswordField, TextField } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { sticky, stickyChecked, type ActionState } from "@/lib/entity-types";

const initial: ActionState = {};

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action] = useActionState(loginAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <h1 className="!text-3xl">Sign in</h1>
      {notice && <p className="alert alert-info" role="status">{notice}</p>}
      <FormAlert state={state} />
      <TextField label="Email" name="email" type="email" autoComplete="username" required autoFocus defaultValue={sticky(state, "email", "")} error={state.fieldErrors?.email} />
      <PasswordField label="Password" name="password" autoComplete="current-password" required error={state.fieldErrors?.password} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CheckboxField label="Remember me" name="remember" defaultChecked={stickyChecked(state, "remember", false)} />
        <Link href="/admin/forgot-password" className="text-sm font-semibold text-primary underline underline-offset-2">
          Forgot password?
        </Link>
      </div>
      <SubmitButton className="btn btn-primary btn-lg btn-block" pendingLabel="Signing in...">Sign in</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(forgotPasswordAction, initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <h1 className="!text-3xl">Forgot password</h1>
      <p className="text-sm text-ink/70">Enter your admin email and we will send you a link to choose a new password.</p>
      <FormAlert state={state} />
      {!state.ok && <TextField label="Email" name="email" type="email" autoComplete="username" required autoFocus defaultValue={sticky(state, "email", "")} error={state.fieldErrors?.email} />}
      {!state.ok && <SubmitButton className="btn btn-primary btn-lg btn-block" pendingLabel="Sending...">Send reset link</SubmitButton>}
      <p className="text-center text-sm">
        <Link href="/admin/login" className="font-semibold text-primary underline underline-offset-2">Back to sign in</Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction.bind(null, token), initial);
  return (
    <form action={action} className="space-y-4" noValidate>
      <h1 className="!text-3xl">Choose a new password</h1>
      <FormAlert state={state} />
      <PasswordField
        label="New password"
        name="password"
        autoComplete="new-password"
        required
        help="At least 10 characters, with letters and numbers."
        error={state.fieldErrors?.password}
      />
      <PasswordField label="Repeat the new password" name="confirm" autoComplete="new-password" required error={state.fieldErrors?.confirm} />
      <SubmitButton className="btn btn-primary btn-lg btn-block" pendingLabel="Saving...">Save new password</SubmitButton>
    </form>
  );
}
