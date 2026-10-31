import { formatMoney } from "@/lib/money";
import { imageUrl } from "@/lib/images";
import type { OrderItemData } from "@/lib/types";

/** Line items of an order, including the contents of custom gifts. Used by the admin, print slip and confirmation page. */
export function OrderItems({ items, showImages = true, compact = false }: { items: OrderItemData[]; showImages?: boolean; compact?: boolean }) {
  return (
    <ul className="divide-y divide-primary/10">
      {items.map((item) => (
        <li key={item.id} className={`flex gap-3 ${compact ? "py-2" : "py-3"}`}>
          {showImages &&
            (item.imageKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl(item.imageKey, 400)} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
            ) : (
              <span className="h-14 w-14 shrink-0 rounded-xl bg-primary/10" />
            ))}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{item.name}</p>
            {item.variantLabel && <p className="text-sm text-ink/70">{item.variantLabel}</p>}
            {item.gift && (
              <div className="mt-1 space-y-0.5 text-sm text-ink/75">
                {item.gift.occasion && <p>Occasion: {item.gift.occasion}</p>}
                <ul className="list-disc ps-5">
                  {item.gift.items.map((g, i) => <li key={i}>{g.qty} × {g.name}</li>)}
                </ul>
                {item.gift.wrapping && <p>Wrapping: {item.gift.wrapping}</p>}
                {item.gift.ribbon && (
                  <p className="flex items-center gap-1.5">
                    Ribbon: {item.gift.ribbon.name}
                    {item.gift.ribbon.color && <span className="inline-block h-3.5 w-3.5 rounded-full border border-ink/20" style={{ background: item.gift.ribbon.color }} />}
                  </p>
                )}
                {item.gift.cardMessage && <p className="italic">Card: “{item.gift.cardMessage}”</p>}
              </div>
            )}
            <p className="text-sm text-ink/65">{item.quantity} × {formatMoney(item.unitPrice)}</p>
          </div>
          <p className="whitespace-nowrap font-bold">{formatMoney(item.lineTotal)}</p>
        </li>
      ))}
    </ul>
  );
}
