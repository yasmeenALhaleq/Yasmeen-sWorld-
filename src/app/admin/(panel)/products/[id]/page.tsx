import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ProductForm } from "@/components/admin/ProductForm";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Icon } from "@/components/ui/Icon";
import { query } from "@/server/db/pool";
import { getAdminProduct } from "@/server/services/admin-products";
import { deleteProductAction, duplicateProductAction } from "@/app/admin/_actions/products";

export const metadata = { title: "Edit product" };

export default async function EditProductPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const productId = Number(id);
  if (!Number.isInteger(productId) || productId < 1) notFound();

  const [product, categories, occasions, scents] = await Promise.all([
    getAdminProduct(productId),
    query<{ id: number; name: string }>("SELECT id, name FROM categories ORDER BY sort_order, name"),
    query<{ id: number; name: string }>("SELECT id, name FROM occasions ORDER BY sort_order, name"),
    query<{ id: number; name: string }>("SELECT id, name FROM scents ORDER BY sort_order, name"),
  ]);
  if (!product) notFound();

  return (
    <>
      <AdminPageHeader
        title={product.name}
        description={product.isActive ? "Visible in the shop" : "Hidden from the shop"}
        actions={
          <>
            {product.isActive && (
              <Link href={`/product/${product.slug}`} target="_blank" className="btn btn-soft btn-sm"><Icon name="external" className="h-4 w-4" /> View in shop</Link>
            )}
            <form action={duplicateProductAction.bind(null, product.id)}>
              <button type="submit" className="btn btn-soft btn-sm"><Icon name="copy" className="h-4 w-4" /> Duplicate</button>
            </form>
            <form action={deleteProductAction.bind(null, product.id)}>
              <ConfirmButton message={`Delete “${product.name}” permanently? Past orders keep their record of it.`}><Icon name="trash" className="h-4 w-4" /> Delete</ConfirmButton>
            </form>
          </>
        }
      />
      {sp.created && <p className="alert alert-success mb-4" role="status">Product created. You can keep editing it here.</p>}
      {sp.duplicated && <p className="alert alert-success mb-4" role="status">This is a copy. It is hidden until you tick “Visible in the shop”.</p>}
      <ProductForm key={product.id} product={product} categories={categories} occasions={occasions} scents={scents} />
    </>
  );
}
