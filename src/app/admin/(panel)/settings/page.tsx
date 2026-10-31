import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { StoreSettingsForm } from "@/components/admin/SettingsForms";
import { getSettings } from "@/server/services/settings";

export const metadata = { title: "Store settings" };

export default async function SettingsPage() {
  const settings = await getSettings();
  return (
    <>
      <AdminPageHeader title="Store settings" description="Name, contact details, delivery rules and payment options." />
      <StoreSettingsForm settings={settings} />
    </>
  );
}
