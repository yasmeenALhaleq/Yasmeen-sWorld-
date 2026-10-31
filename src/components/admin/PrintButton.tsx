"use client";

import { Icon } from "@/components/ui/Icon";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" className="btn btn-primary btn-sm" onClick={() => window.print()}>
      <Icon name="printer" className="h-4 w-4" /> {label}
    </button>
  );
}
