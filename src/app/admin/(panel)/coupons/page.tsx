import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EntitySection, entityTitle } from "@/components/admin/EntitySection";

export const metadata = { title: "Coupon codes" };

export default function CouponsPage() {
  const { title, description } = entityTitle("coupons");
  return (
    <>
      <AdminPageHeader title={title} description={description} />
      <EntitySection entityKey="coupons" />
    </>
  );
}
