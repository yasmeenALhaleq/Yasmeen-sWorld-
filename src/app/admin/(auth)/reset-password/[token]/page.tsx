import Link from "next/link";
import { isResetTokenValid } from "@/server/services/admin-auth";
import { ResetPasswordForm } from "@/components/admin/AuthForms";

export const metadata = { title: "Reset password" };

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!(await isResetTokenValid(token))) {
    return (
      <div className="space-y-4">
        <h1 className="!text-3xl">Link expired</h1>
        <p className="alert alert-error">This reset link is not valid any more. Links work once and expire after 1 hour.</p>
        <Link href="/admin/forgot-password" className="btn btn-primary btn-block">Request a new link</Link>
      </div>
    );
  }
  return <ResetPasswordForm token={token} />;
}
