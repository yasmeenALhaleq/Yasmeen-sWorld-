import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ProductForm } from "@/components/admin/ProductForm";
import { query } from "@/server/db/pool";

export const metadata = { title: "New product" };

export default async function NewProductPage() {
  const [categories, occasions, scents] = await Promise.all([
    query<{ id: number; name: string }>("SELECT id, name FROM categories ORDER BY sort_order, name"),
    query<{ id: number; name: string }>("SELECT id, name FROM occasions ORDER BY sort_order, name"),
    query<{ id: number; name: string }>("SELECT id, name FROM scents ORDER BY sort_order, name"),
  ]);
  return (
    <>
      <AdminPageHeader title="New product" />
      <ProductForm product={null} categories={categories} occasions={occasions} scents={scents} />
    </>
  );
}
