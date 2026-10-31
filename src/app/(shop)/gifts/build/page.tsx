import type { Metadata } from "next";
import { GiftBuilder } from "@/components/shop/GiftBuilder";
import { PageHero } from "@/components/shop/PageHero";
import { getBuilderData } from "@/server/services/gifts";
import { t } from "@/i18n";

export const metadata: Metadata = {
  title: t("builder.title"),
  description: t("builder.description"),
  alternates: { canonical: "/gifts/build" },
};

export default async function BuildGiftPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const [data, sp] = await Promise.all([getBuilderData(), searchParams]);
  const slug = Array.isArray(sp.occasion) ? sp.occasion[0] : sp.occasion;
  const initialOccasionId = data.occasions.find((o) => o.slug === slug)?.id ?? null;

  return (
    <>
      <PageHero eyebrow={t("builder.eyebrow")} title={t("builder.title")} text={t("builder.description")} />
      <div className="container-page section !pt-8">
        <GiftBuilder data={data} initialOccasionId={initialOccasionId} />
      </div>
    </>
  );
}
