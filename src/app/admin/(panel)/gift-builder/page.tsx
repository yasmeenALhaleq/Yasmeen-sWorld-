import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { EntitySection, entityTitle } from "@/components/admin/EntitySection";
import { listAdminProducts } from "@/server/services/admin-products";
import { toggleProductAction } from "@/app/admin/_actions/products";
import { formatMoney } from "@/lib/money";
import { imageUrl } from "@/lib/images";

export const metadata = { title: "Gift builder" };

export default async function GiftBuilderAdminPage() {
  const products = await listAdminProducts({ pageSize: 100 });
  const parts = ["gift_bases", "gift_sizes", "gift_wrappings", "gift_ribbons"].map((k) => ({ key: k, ...entityTitle(k) }));
  const eligible = products.items.filter((p) => p.inBuilder).length;

  return (
    <>
      <AdminPageHeader
        title="Gift builder"
        description="Control what customers can choose in “Build Your Own Gift”: bases and sizes, wrapping, ribbons, occasions and products."
        actions={<Link href="/gifts/build" target="_blank" className="btn btn-soft btn-sm">Preview the builder</Link>}
      />

      <div className="space-y-12">
        {parts.map((p) => (
          <section key={p.key}>
            <h2 className="mb-1 !text-3xl">{p.title}</h2>
            <p className="mb-4 text-sm text-ink/70">{p.description}</p>
            <EntitySection entityKey={p.key} />
          </section>
        ))}

        <section aria-labelledby="occ-title">
          <h2 id="occ-title" className="mb-1 !text-3xl">Occasions</h2>
          <p className="text-sm text-ink/70">
            Step 1 shows every occasion that has “Offer in Build Your Own Gift” switched on.{" "}
            <Link href="/admin/occasions" className="font-semibold text-primary underline underline-offset-2">Manage occasions</Link>
          </p>
        </section>

        <section aria-labelledby="prod-title">
          <h2 id="prod-title" className="mb-1 !text-3xl">Products customers can add</h2>
          <p className="mb-4 text-sm text-ink/70">
            {eligible} of {products.total} products are available in the builder. Switch products on or off here; you can also change it on each product.
          </p>
          {products.items.length === 0 ? (
            <p className="alert alert-info">Add products first, then choose which ones appear in the gift builder.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th scope="col" className="w-14"><span className="sr-only">Picture</span></th><th scope="col">Product</th><th scope="col">Category</th><th scope="col">Price</th><th scope="col" className="text-end">In builder</th></tr>
                </thead>
                <tbody>
                  {products.items.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.imageKey
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={imageUrl(p.imageKey, 400)} alt="" className="h-10 w-10 rounded-lg object-cover" />
                          : <span className="block h-10 w-10 rounded-lg bg-primary/10" />}
                      </td>
                      <td className="font-semibold">{p.name}</td>
                      <td>{p.categoryName ?? "—"}</td>
                      <td>{formatMoney(p.price)}</td>
                      <td className="text-end">
                        <form action={toggleProductAction.bind(null, p.id, "in_builder", !p.inBuilder)}>
                          <button type="submit" className={`badge cursor-pointer ${p.inBuilder ? "badge-ok" : "badge-soft"}`}>
                            {p.inBuilder ? "Available" : "Not available"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
