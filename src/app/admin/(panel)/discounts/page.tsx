import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EntitySection, entityTitle } from "@/components/admin/EntitySection";

export const metadata = { title: "Discounts" };

export default function DiscountsPage() {
  const { title, description } = entityTitle("discounts");
  return (
    <>
      <AdminPageHeader title={title} description={description} />
      <EntitySection entityKey="discounts" />
    </>
  );
}
