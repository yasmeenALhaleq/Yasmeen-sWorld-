import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/Pagination";
import { listAdminProducts, type AdminProductListParams } from "@/server/services/admin-products";
import { getEntity, listEntityRows } from "@/server/admin/entities";
import { deleteProductAction, duplicateProductAction, toggleProductAction } from "@/app/admin/_actions/products";
import { formatMoney } from "@/lib/money";
import { imageUrl } from "@/lib/images";

export const metadata = { title: "Products" };

type SP = { [key: string]: string | string[] | undefined };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "active", label: "Visible" },
  { value: "hidden", label: "Hidden" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
] as const;

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const status = first(sp.status);
  const params: AdminProductListParams = {
    q: first(sp.q),
    categoryId: Number(first(sp.category)) || undefined,
    status: STATUS_TABS.some((t) => t.value === status && t.value) ? (status as AdminProductListParams["status"]) : undefined,
    page: Number(first(sp.page)) || 1,
  };
  const [result, categories] = await Promise.all([listAdminProducts(params), listEntityRows(getEntity("categories")!)]);
  const keep = { q: params.q, category: first(sp.category), status: params.status };

  return (
    <>
      <AdminPageHeader
        title="Products"
        description={`${result.total} product${result.total === 1 ? "" : "s"}`}
        actions={<Link href="/admin/products/new" className="btn btn-primary btn-sm"><Icon name="plus" className="h-4 w-4" /> Add product</Link>}
      />

      {first(sp.deleted) && <p className="alert alert-success mb-4" role="status">The product was deleted.</p>}

      <form className="mb-4 flex flex-wrap items-end gap-3" role="search">
        <div className="min-w-48 flex-1">
          <label htmlFor="q" className="label">Search</label>
          <input id="q" name="q" defaultValue={params.q} className="input" placeholder="Product name" />
        </div>
        <div>
          <label htmlFor="category" className="label">Category</label>
          <select id="category" name="category" defaultValue={first(sp.category) ?? ""} className="input">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{String(c.values.name)}</option>)}
          </select>
        </div>
        {params.status && <input type="hidden" name="status" value={params.status} />}
        <button className="btn btn-soft">Filter</button>
      </form>

      <nav aria-label="Product status" className="mb-4 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const sp2 = new URLSearchParams();
          if (params.q) sp2.set("q", params.q);
          if (keep.category) sp2.set("category", keep.category);
          if (tab.value) sp2.set("status", tab.value);
          const current = (params.status ?? "") === tab.value;
          return (
            <Link key={tab.value} href={`/admin/products${sp2.size ? `?${sp2}` : ""}`} className="chip" aria-current={current ? "true" : undefined}>
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {result.items.length === 0 ? (
        <div className="card card-pad text-center">
          <p className="mb-4">No products found.</p>
          <Link href="/admin/products/new" className="btn btn-primary">Add your first product</Link>
        </div>
      ) : (
        <>
        {/* Phones: one card per product (a wide table would need sideways scrolling). */}
        <ul className="space-y-3 md:hidden" aria-label="Products">
          {result.items.map((p) => (
            <li key={p.id} className="card card-pad">
              <div className="flex gap-3">
                {p.imageKey
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={imageUrl(p.imageKey, 400)} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                  : <span className="block h-16 w-16 shrink-0 rounded-xl bg-primary/10" />}
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/products/${p.id}`} className="font-semibold leading-snug hover:underline">{p.name}</Link>
                  <p className="text-xs text-ink/60">{p.categoryName ?? "No category"}{p.isDemo ? " · Sample" : ""}</p>
                  <p className="mt-1 text-sm">
                    <strong>{formatMoney(p.price)}</strong>
                    <span className="mx-2 text-ink/30">|</span>
                    {p.stock === null ? <span className="text-ink/60">Stock not tracked</span> : p.stock <= 0 ? <span className="badge badge-bad">Out of stock</span> : <span>{p.stock} in stock</span>}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <form action={toggleProductAction.bind(null, p.id, "is_active", !p.isActive)}>
                  <button type="submit" className={`badge cursor-pointer !px-3 !py-1.5 ${p.isActive ? "badge-ok" : "badge-soft"}`}>{p.isActive ? "Visible" : "Hidden"}</button>
                </form>
                <Link href={`/admin/products/${p.id}`} className="btn btn-soft btn-sm ms-auto"><Icon name="edit" className="h-4 w-4" /> Edit</Link>
                <form action={duplicateProductAction.bind(null, p.id)}>
                  <button type="submit" className="btn btn-ghost btn-sm !px-2" aria-label={`Duplicate ${p.name}`}><Icon name="copy" className="h-4 w-4" /></button>
                </form>
                <form action={deleteProductAction.bind(null, p.id)}>
                  <ConfirmButton message={`Delete “${p.name}” permanently? Past orders keep their record of it.`} className="btn btn-danger btn-sm !px-2">
                    <Icon name="trash" className="h-4 w-4" /><span className="sr-only">Delete {p.name}</span>
                  </ConfirmButton>
                </form>
              </div>
            </li>
          ))}
        </ul>

        <div className="table-wrap hidden md:block">
          <table className="table">
            <thead>
              <tr>
                <th scope="col" className="w-16"><span className="sr-only">Picture</span></th>
                <th scope="col">Product</th>
                <th scope="col">Price</th>
                <th scope="col">Stock</th>
                <th scope="col">Sold</th>
                <th scope="col">Visible</th>
                <th scope="col" className="text-end"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.imageKey
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={imageUrl(p.imageKey, 400)} alt="" className="h-12 w-12 rounded-xl object-cover" />
                      : <span className="block h-12 w-12 rounded-xl bg-primary/10" />}
                  </td>
                  <td>
                    <Link href={`/admin/products/${p.id}`} className="font-semibold hover:underline">{p.name}</Link>
                    <div className="flex flex-wrap gap-1.5 pt-0.5 text-xs text-ink/60">
                      <span>{p.categoryName ?? "No category"}</span>
                      {p.isFeatured && <span className="badge badge-soft">Featured</span>}
                      {p.inBuilder && <span className="badge badge-soft">Gift builder</span>}
                      {p.isDemo && <span className="badge badge-warn">Sample</span>}
                    </div>
                  </td>
                  <td className="whitespace-nowrap font-semibold">{formatMoney(p.price)}</td>
                  <td>
                    {p.stock === null ? <span className="text-ink/50">Not tracked</span>
                      : p.stock <= 0 ? <span className="badge badge-bad">Out</span>
                      : <span>{p.stock}</span>}
                  </td>
                  <td>{p.soldCount}</td>
                  <td>
                    <form action={toggleProductAction.bind(null, p.id, "is_active", !p.isActive)}>
                      <button type="submit" className={`badge cursor-pointer ${p.isActive ? "badge-ok" : "badge-soft"}`} title={p.isActive ? "Click to hide" : "Click to show"}>
                        {p.isActive ? "Visible" : "Hidden"}
                      </button>
                    </form>
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/admin/products/${p.id}`} className="btn btn-soft btn-sm"><Icon name="edit" className="h-4 w-4" /> Edit</Link>
                      <form action={duplicateProductAction.bind(null, p.id)}>
                        <button type="submit" className="btn btn-ghost btn-sm !px-2" title="Duplicate" aria-label={`Duplicate ${p.name}`}><Icon name="copy" className="h-4 w-4" /></button>
                      </form>
                      <form action={deleteProductAction.bind(null, p.id)}>
                        <ConfirmButton message={`Delete “${p.name}” permanently? Past orders keep their record of it.`} className="btn btn-danger btn-sm !px-2" title="Delete">
                          <Icon name="trash" className="h-4 w-4" /><span className="sr-only">Delete {p.name}</span>
                        </ConfirmButton>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
      <Pagination basePath="/admin/products" params={keep} page={result.page} pages={result.pages} />
    </>
  );
}
