import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClearCartOnMount } from "@/components/shop/ClearCartOnMount";
import { OrderItems } from "@/components/OrderItems";
import { OrderTotals } from "@/components/OrderTotals";
import { CornerSprigs } from "@/components/ui/Botanical";
import { Icon } from "@/components/ui/Icon";
import { getConfirmationEmailStatus, getOrderByToken } from "@/server/services/orders";
import { getSettings } from "@/server/services/settings";
import { formatDay } from "@/lib/time";
import { t, type MessageKey } from "@/i18n";

export const metadata: Metadata = { title: t("order.title"), robots: { index: false, follow: false } };

const STEPS = ["new", "preparing", "out_for_delivery", "delivered"] as const;

export default async function OrderPage({
  params, searchParams,
}: { params: Promise<{ token: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { token } = await params;
  const order = await getOrderByToken(token);
  if (!order) notFound();

  const [settings, emailStatus, sp] = await Promise.all([getSettings(), getConfirmationEmailStatus(order.id), searchParams]);
  const justPlaced = Boolean(sp.new);
  const cancelled = order.status === "cancelled";
  const stepIndex = STEPS.indexOf(order.status as (typeof STEPS)[number]);
  const whatsapp = settings.whatsappNumber
    ? `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(t("order.whatsappText", { number: order.orderNumber }))}`
    : "";

  return (
    <div className="relative">
      {justPlaced && <ClearCartOnMount />}
      <section className="relative overflow-hidden bg-gradient-to-br from-secondary/30 via-page to-accent/20">
        <CornerSprigs />
        <div className="container-page relative py-12 text-center sm:py-16">
          <span className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${cancelled ? "bg-red-100 text-red-800" : "bg-emerald-100 text-emerald-800"}`}>
            <Icon name={cancelled ? "x" : "check"} className="h-8 w-8" />
          </span>
          <h1 className="text-balance !text-4xl sm:!text-5xl">
            {cancelled ? t("order.cancelledTitle") : justPlaced ? t("order.thanks", { name: order.customerName.split(" ")[0] }) : t("order.title")}
          </h1>
          <p className="mt-3 text-lg">
            {t("order.number")}: <strong className="font-extrabold text-primary" dir="ltr">{order.orderNumber}</strong>
          </p>
          {justPlaced && !cancelled && <p className="mx-auto mt-2 max-w-lg text-ink/75">{t("order.intro")}</p>}
        </div>
      </section>

      <div className="container-page grid gap-6 py-10 lg:grid-cols-[1fr_22rem] lg:items-start">
        <div className="space-y-6">
          {!cancelled && (
            <section className="card card-pad" aria-labelledby="progress-title">
              <h2 id="progress-title" className="mb-4 !text-2xl">{t("order.status")}</h2>
              <ol className="grid grid-cols-4 gap-2 text-center text-xs font-bold sm:text-sm">
                {STEPS.map((s, i) => (
                  <li key={s} aria-current={i === stepIndex ? "step" : undefined} className={i <= stepIndex ? "text-primary" : "text-ink/40"}>
                    <span className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full border-2 ${i <= stepIndex ? "border-primary bg-primary text-on-primary" : "border-ink/20"}`}>
                      {i < stepIndex ? <Icon name="check" className="h-4 w-4" /> : i + 1}
                    </span>
                    {t(`status.${s}` as MessageKey)}
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="card card-pad" aria-labelledby="items-title">
            <h2 id="items-title" className="mb-2 !text-2xl">{t("order.items")}</h2>
            <OrderItems items={order.items} />
            <div className="ms-auto mt-4 max-w-xs"><OrderTotals order={order} /></div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card card-pad space-y-3 text-sm" aria-labelledby="deliv-title">
            <h2 id="deliv-title" className="!text-2xl">{t("order.delivery")}</h2>
            <p className="flex items-start gap-2"><Icon name="calendar" className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><strong>{formatDay(order.deliveryDate)}</strong></p>
            <p className="flex items-start gap-2"><Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{order.address}, {order.cityName}</span></p>
            <p className="flex items-start gap-2"><Icon name="phone" className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span dir="ltr">{order.phone}</span></p>
            <p className="flex items-start gap-2"><Icon name="bag" className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>{order.paymentMethod === "cod" ? t("payment.cod") : t("payment.online")} · {t(`payment.${order.paymentStatus}` as MessageKey)}</span></p>
            {order.giftMessage && (
              <p className="rounded-2xl bg-secondary/15 p-3 italic"><span className="block text-xs font-bold not-italic uppercase tracking-wider text-ink/60">{t("order.giftMessage")}</span>“{order.giftMessage}”</p>
            )}
          </section>

          {/* Honest about email: only claim it was sent if the mail server accepted it. */}
          {order.email && emailStatus === "sent" && (
            <p className="alert alert-success flex items-start gap-2"><Icon name="mail" className="mt-0.5 h-4 w-4 shrink-0" /> {t("order.emailSent", { email: order.email })}</p>
          )}
          {order.email && emailStatus !== "sent" && (
            <p className="alert alert-info flex items-start gap-2"><Icon name="mail" className="mt-0.5 h-4 w-4 shrink-0" /> {t("order.emailNotSent")}</p>
          )}

          <div className="card card-pad space-y-3 text-center">
            <p className="font-serif text-2xl font-semibold">{t("order.help")}</p>
            <p className="text-sm text-ink/75">{t("order.helpText")}</p>
            {whatsapp && <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-block"><Icon name="whatsapp" className="h-5 w-5" /> {t("footer.whatsapp")}</a>}
            {settings.contactPhone && <a href={`tel:${settings.contactPhone.replace(/\s/g, "")}`} className="btn btn-soft btn-block"><Icon name="phone" className="h-5 w-5" /> <span dir="ltr">{settings.contactPhone}</span></a>}
            <Link href="/shop" className="btn btn-primary btn-block">{t("cart.continue")}</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
