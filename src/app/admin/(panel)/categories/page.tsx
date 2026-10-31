import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EntitySection, entityTitle } from "@/components/admin/EntitySection";

export const metadata = { title: "Categories" };

export default function CategoriesPage() {
  const { title, description } = entityTitle("categories");
  return (
    <>
      <AdminPageHeader title={title} description={description} />
      <EntitySection entityKey="categories" />
    </>
  );
}
