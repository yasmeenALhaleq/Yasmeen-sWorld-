"use client";

import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";
import { t } from "@/i18n";

/** Floating "chat on WhatsApp" button. Hidden on checkout so it never covers a form field. */
export function WhatsAppFab({ href }: { href: string }) {
  const pathname = usePathname();
  if (pathname.startsWith("/checkout")) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("footer.whatsappChat")}
      className="fixed bottom-4 end-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-xl transition hover:scale-105"
    >
      <Icon name="whatsapp" className="h-7 w-7" />
    </a>
  );
}
