import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ThemeEditor } from "@/components/admin/ThemeEditor";
import { getSettings } from "@/server/services/settings";

export const metadata = { title: "Logo & colours" };

export default async function AppearancePage() {
  const settings = await getSettings();
  return (
    <>
      <AdminPageHeader
        title="Logo & colours"
        description="Upload your logo and the site colours are created from it automatically. Adjust anything you like, then save."
      />
      <ThemeEditor savedPalette={settings.theme} savedLogoKey={settings.logoKey} storeName={settings.storeName} />
    </>
  );
}
