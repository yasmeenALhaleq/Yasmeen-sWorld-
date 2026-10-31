"use client";

import { useEffect } from "react";
import { t } from "@/i18n";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1>{t("error.title")}</h1>
      <p className="mt-3 max-w-md text-ink/75">{t("error.text")}</p>
      {error.digest && <p className="mt-2 text-xs text-ink/50">Ref: {error.digest}</p>}
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" className="btn btn-primary btn-lg" onClick={reset}>{t("error.retry")}</button>
        <a href="/" className="btn btn-outline btn-lg">{t("notFound.home")}</a>
      </div>
    </div>
  );
}
