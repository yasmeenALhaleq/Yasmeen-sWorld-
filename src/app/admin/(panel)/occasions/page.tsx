import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EntitySection, entityTitle } from "@/components/admin/EntitySection";

export const metadata = { title: "Occasions" };

export default function OccasionsPage() {
  const { title, description } = entityTitle("occasions");
  return (
    <>
      <AdminPageHeader title={title} description={description} />
      <EntitySection entityKey="occasions" />
    </>
  );
}
