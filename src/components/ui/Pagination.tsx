import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { t } from "@/i18n";

/** Prev / next with page numbers; keeps every other query parameter. */
export function Pagination({
  basePath,
  params,
  page,
  pages,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  page: number;
  pages: number;
}) {
  if (pages <= 1) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    if (p > 1) sp.set("page", String(p));
    const qs = sp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  // 1 ... 4 5 [6] 7 8 ... 20
  const numbers = new Set([1, pages, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pages));
  const list = [...numbers].sort((a, b) => a - b);

  return (
    <nav aria-label={t("pagination.label")} className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link href={href(page - 1)} className="chip" rel="prev">
          <Icon name="chevron-left" className="h-4 w-4 rtl:rotate-180" />
          {t("pagination.prev")}
        </Link>
      )}
      {list.map((n, i) => (
        <span key={n} className="contents">
          {i > 0 && n - list[i - 1] > 1 && <span aria-hidden="true">…</span>}
          <Link href={href(n)} className="chip min-w-9 justify-center px-3" aria-current={n === page ? "true" : undefined}>
            {n}
          </Link>
        </span>
      ))}
      {page < pages && (
        <Link href={href(page + 1)} className="chip" rel="next">
          {t("pagination.next")}
          <Icon name="chevron-right" className="h-4 w-4 rtl:rotate-180" />
        </Link>
      )}
    </nav>
  );
}
