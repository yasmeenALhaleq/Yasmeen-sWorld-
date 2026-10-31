import Link from "next/link";
import { FloralDivider } from "@/components/ui/Botanical";
import { t } from "@/i18n";

/** Centered section title with an optional eyebrow, subtitle and "view all" link. */
export function SectionHeading({
  id, eyebrow, title, subtitle, href, hrefLabel, as: Tag = "h2",
}: { id?: string; eyebrow?: string; title: string; subtitle?: string; href?: string; hrefLabel?: string; as?: "h1" | "h2" }) {
  return (
    <header className="mx-auto mb-8 max-w-2xl text-center sm:mb-10">
      {eyebrow && <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.25em] text-accent">{eyebrow}</p>}
      <Tag id={id} className="text-balance">{title}</Tag>
      <FloralDivider className="mt-3" />
      {subtitle && <p className="mt-3 text-ink/75">{subtitle}</p>}
      {href && (
        <Link href={href} className="mt-3 inline-block text-sm font-bold text-primary underline underline-offset-4 hover:no-underline">
          {hrefLabel ?? t("common.viewAll")}
        </Link>
      )}
    </header>
  );
}
