import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ChangePasswordForm } from "@/components/admin/SettingsForms";
import { requireAdmin } from "@/server/auth/session";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const admin = await requireAdmin();
  return (
    <>
      <AdminPageHeader title="My account" description={`Signed in as ${admin.email}`} />
      <ChangePasswordForm />
    </>
  );
}
