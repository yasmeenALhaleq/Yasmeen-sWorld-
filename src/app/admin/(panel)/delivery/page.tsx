import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EntitySection, entityTitle } from "@/components/admin/EntitySection";

export const metadata = { title: "Delivery fees" };

export default function DeliveryPage() {
  const { title, description } = entityTitle("cities");
  return (
    <>
      <AdminPageHeader title={title} description={description} />
      <EntitySection entityKey="cities" />
    </>
  );
}
