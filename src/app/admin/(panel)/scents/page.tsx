import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EntitySection, entityTitle } from "@/components/admin/EntitySection";

export const metadata = { title: "Scents" };

export default function ScentsPage() {
  const { title, description } = entityTitle("scents");
  return (
    <>
      <AdminPageHeader title={title} description={description} />
      <EntitySection entityKey="scents" />
    </>
  );
}
