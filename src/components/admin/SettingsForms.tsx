"use client";

import { useActionState } from "react";
import { saveStoreSettingsAction } from "@/app/admin/_actions/settings";
import { changePasswordAction } from "@/app/admin/_actions/auth";
import { CheckboxField, FormAlert, PasswordField, TextAreaField, TextField } from "@/components/ui/Fields";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Settings } from "@/server/services/settings";
import { sticky, stickyChecked, type ActionState } from "@/lib/entity-types";

const initial: ActionState = {};

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card card-pad space-y-4">
      <div>
        <h2 className="!text-2xl">{title}</h2>
        {hint && <p className="mt-1 text-sm text-ink/65">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function StoreSettingsForm({ settings }: { settings: Settings }) {
  const [state, action] = useActionState(saveStoreSettingsAction, initial);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-6" noValidate>
      <Section title="Store">
        <TextField label="Store name" name="storeName" defaultValue={sticky(state, "storeName", String(settings.storeName))} required maxLength={80} error={e.storeName} />
        <TextField label="Tagline" name="tagline" defaultValue={sticky(state, "tagline", String(settings.tagline))} maxLength={160} help="A short line shown next to the name and in search results." error={e.tagline} />
        <TextAreaField label="About the store" name="aboutText" defaultValue={sticky(state, "aboutText", String(settings.aboutText))} rows={3} maxLength={600} help="Shown in the website footer." error={e.aboutText} />
        <TextAreaField label="Search engine description" name="metaDescription" defaultValue={sticky(state, "metaDescription", String(settings.metaDescription))} rows={2} maxLength={320} help="What Google shows under your home page link." error={e.metaDescription} />
        <TextField label="Announcement bar" name="announcement" defaultValue={sticky(state, "announcement", String(settings.announcement))} maxLength={160} help="A one-line message above the menu, e.g. “Free delivery on orders over 40 JOD”. Leave empty to hide it." error={e.announcement} />
      </Section>

      <Section title="Contact & social" hint="Shown in the footer and used for the WhatsApp button.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Contact phone" name="contactPhone" defaultValue={sticky(state, "contactPhone", String(settings.contactPhone))} maxLength={40} placeholder="+962 7 9000 0000" error={e.contactPhone} />
          <TextField label="WhatsApp number" name="whatsappNumber" defaultValue={sticky(state, "whatsappNumber", String(settings.whatsappNumber))} maxLength={30} inputMode="tel" placeholder="962790000000"
            help="With country code, digits only. Adds a WhatsApp button to the site." error={e.whatsappNumber} />
          <TextField label="Contact email" name="contactEmail" type="email" defaultValue={sticky(state, "contactEmail", String(settings.contactEmail))} maxLength={190}
            help="Shown in the footer. If email sending is set up, new-order alerts go here too." error={e.contactEmail} />
          <TextField label="Instagram" name="instagramUrl" defaultValue={sticky(state, "instagramUrl", String(settings.instagramUrl))} maxLength={200} placeholder="@yasmeenworld" help="Your @handle or profile link." error={e.instagramUrl} />
        </div>
      </Section>

      <Section title="Delivery & payment">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="Earliest delivery (days ahead)" name="deliveryLeadDays" type="number" min={0} max={30} defaultValue={sticky(state, "deliveryLeadDays", String(settings.deliveryLeadDays))} required
            help="1 = customers can choose tomorrow at the earliest." error={e.deliveryLeadDays} />
          <TextField label="Latest delivery (days ahead)" name="deliveryMaxDays" type="number" min={1} max={365} defaultValue={sticky(state, "deliveryMaxDays", String(settings.deliveryMaxDays))} required error={e.deliveryMaxDays} />
          <TextField label="Free delivery from (JOD)" name="freeDeliveryThreshold" type="number" min={0} step="any" defaultValue={sticky(state, "freeDeliveryThreshold", String(settings.freeDeliveryThreshold))}
            help="0 turns free delivery off." error={e.freeDeliveryThreshold} />
        </div>
        <CheckboxField label="Accept cash on delivery" name="codEnabled" defaultChecked={stickyChecked(state, "codEnabled", settings.codEnabled)} help="Online card payment is not enabled yet; the checkout is ready for it (see README)." />
        <p className="text-sm text-ink/65">Delivery fees for each city are in <a href="/admin/delivery" className="font-semibold text-primary underline underline-offset-2">Delivery fees</a>.</p>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving..." className="btn btn-primary btn-lg">Save settings</SubmitButton>
        <div className="min-w-0 flex-1"><FormAlert state={state} /></div>
      </div>
    </form>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, initial);
  return (
    <form action={action} className="card card-pad max-w-md space-y-4" noValidate>
      <h2 className="!text-2xl">Change password</h2>
      <FormAlert state={state} />
      <PasswordField label="Current password" name="current" autoComplete="current-password" required />
      <PasswordField label="New password" name="password" autoComplete="new-password" required help="At least 10 characters, with letters and numbers." error={state.fieldErrors?.password} />
      <PasswordField label="Repeat the new password" name="confirm" autoComplete="new-password" required error={state.fieldErrors?.confirm} />
      <SubmitButton pendingLabel="Saving...">Change password</SubmitButton>
    </form>
  );
}
