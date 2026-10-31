import "server-only";
import { escapeHtml } from "@/lib/html";
import { formatMoney } from "@/lib/money";
import { formatDay } from "@/lib/time";
import { logoUrl } from "@/lib/images";
import { readableTextOn } from "@/lib/palette";
import { env } from "@/server/env";
import { t, type MessageKey } from "@/i18n";
import type { OrderData } from "@/lib/types";
import type { Settings } from "@/server/services/settings";

// Email clients ignore <style> blocks and CSS variables, so templates use
// table layout with inline styles and the theme colours resolved to hex.

function shell(settings: Settings, title: string, bodyHtml: string): string {
  const c = settings.theme;
  const logo = settings.logoKey
    ? `<img src="${escapeHtml(env.siteUrl + logoUrl(settings.logoKey))}" alt="${escapeHtml(settings.storeName)}" height="48" style="height:48px;display:block;margin:0 auto 8px">`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:0;background:${c.background};font-family:Helvetica,Arial,sans-serif;color:${c.text}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${c.background};padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:${c.surface};border-radius:16px;overflow:hidden">
<tr><td style="background:${c.primary};padding:24px;text-align:center;color:${readableTextOn(c.primary)}">${logo}<div style="font-family:Georgia,serif;font-size:24px;letter-spacing:.5px">${escapeHtml(settings.storeName)}</div></td></tr>
<tr><td style="padding:28px 28px 12px"><h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px;color:${c.text}">${escapeHtml(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:12px 28px 28px;font-size:12px;color:${c.text};opacity:.7">${escapeHtml(settings.tagline)}</td></tr>
</table></td></tr></table></body></html>`;
}

const row = (label: string, value: string, bold = false) =>
  `<tr><td style="padding:4px 0;color:#6b5560">${escapeHtml(label)}</td><td style="padding:4px 0;text-align:right;${bold ? "font-weight:bold;font-size:16px" : ""}">${value}</td></tr>`;

export function renderOrderConfirmation(order: OrderData, settings: Settings) {
  const tr = (key: MessageKey, params?: Record<string, string | number>) => t(key, params);
  const c = settings.theme;
  const contact = settings.whatsappNumber || settings.contactPhone || settings.contactEmail || settings.storeName;

  const itemsHtml = order.items
    .map((item) => {
      const gift = item.gift
        ? `<div style="font-size:12px;color:#6b5560;margin-top:2px">${escapeHtml(
            [
              item.gift.size,
              ...item.gift.items.map((i) => `${i.qty} x ${i.name}`),
              item.gift.wrapping,
              item.gift.ribbon ? `${item.gift.ribbon.name} ribbon` : null,
            ].filter(Boolean).join(" · "),
          )}</div>`
        : "";
      const variant = item.variantLabel ? ` <span style="color:#6b5560">(${escapeHtml(item.variantLabel)})</span>` : "";
      return `<tr><td style="padding:8px 0;border-bottom:1px solid ${c.background}">${escapeHtml(item.name)}${variant}${gift}
<div style="font-size:12px;color:#6b5560">${item.quantity} x ${formatMoney(item.unitPrice)}</div></td>
<td style="padding:8px 0;border-bottom:1px solid ${c.background};text-align:right;white-space:nowrap">${formatMoney(item.lineTotal)}</td></tr>`;
    })
    .join("");

  const totals = [
    row(tr("email.order.subtotal"), formatMoney(order.subtotal)),
    order.savings > 0 ? row(tr("email.order.savings"), formatMoney(order.savings)) : "",
    order.couponDiscount > 0 ? row(tr("email.order.coupon", { code: order.couponCode ?? "" }), `- ${formatMoney(order.couponDiscount)}`) : "",
    row(tr("email.order.deliveryFee"), order.deliveryFee === 0 ? tr("email.order.free") : formatMoney(order.deliveryFee)),
    row(tr("email.order.total"), formatMoney(order.total), true),
  ].join("");

  const body = `
<p style="line-height:1.5;margin:0 0 16px">${escapeHtml(tr("email.order.intro"))}</p>
<p style="margin:0 0 4px;color:#6b5560;font-size:13px">${escapeHtml(tr("email.order.number"))}</p>
<p style="margin:0 0 16px;font-size:18px;font-weight:bold;color:${c.primary}">${escapeHtml(order.orderNumber)}</p>
<p style="margin:0 0 4px;color:#6b5560;font-size:13px">${escapeHtml(tr("email.order.delivery"))}</p>
<p style="margin:0 0 16px;line-height:1.5">${escapeHtml(formatDay(order.deliveryDate))}<br>${escapeHtml(order.address)}, ${escapeHtml(order.cityName)}</p>
<p style="margin:0 0 4px;color:#6b5560;font-size:13px">${escapeHtml(tr("email.order.payment"))}</p>
<p style="margin:0 0 16px">${escapeHtml(order.paymentMethod === "cod" ? tr("payment.cod") : tr("payment.online"))}</p>
${order.giftMessage ? `<p style="margin:0 0 4px;color:#6b5560;font-size:13px">${escapeHtml(tr("email.order.giftMessage"))}</p><p style="margin:0 0 16px;font-style:italic;line-height:1.5">“${escapeHtml(order.giftMessage)}”</p>` : ""}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;margin-bottom:12px">${itemsHtml}</table>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px">${totals}</table>
<p style="margin:20px 0 0;font-size:13px;color:#6b5560">${escapeHtml(tr("email.order.footer", { contact }))}</p>`;

  const text = [
    tr("email.order.heading", { name: order.customerName }),
    `${tr("email.order.number")}: ${order.orderNumber}`,
    `${tr("email.order.delivery")}: ${formatDay(order.deliveryDate)}, ${order.address}, ${order.cityName}`,
    "",
    ...order.items.map((i) => `${i.quantity} x ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""} - ${formatMoney(i.lineTotal)}`),
    "",
    `${tr("email.order.total")}: ${formatMoney(order.total)}`,
  ].join("\n");

  return {
    subject: tr("email.order.subject", { store: settings.storeName, number: order.orderNumber }),
    html: shell(settings, tr("email.order.heading", { name: order.customerName }), body),
    text,
  };
}

export function renderPasswordReset(resetUrl: string, settings: Settings) {
  const c = settings.theme;
  const body = `
<p style="line-height:1.5;margin:0 0 20px">${escapeHtml(t("email.reset.body", { store: settings.storeName }))}</p>
<p style="margin:0 0 24px"><a href="${escapeHtml(resetUrl)}" style="background:${c.button};color:${readableTextOn(c.button)};text-decoration:none;padding:12px 22px;border-radius:999px;display:inline-block">${escapeHtml(t("email.reset.button"))}</a></p>
<p style="font-size:12px;color:#6b5560;word-break:break-all;margin:0 0 16px">${escapeHtml(resetUrl)}</p>
<p style="font-size:13px;color:#6b5560;margin:0">${escapeHtml(t("email.reset.ignore"))}</p>`;
  return {
    subject: t("email.reset.subject", { store: settings.storeName }),
    html: shell(settings, t("email.reset.heading"), body),
    text: `${t("email.reset.body", { store: settings.storeName })}\n\n${resetUrl}\n\n${t("email.reset.ignore")}`,
  };
}
