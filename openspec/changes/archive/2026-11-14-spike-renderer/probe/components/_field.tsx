// Shared by the field atoms; bundled into each chunk that imports it.

import type { ReactNode } from "react";

export const Field = ({ id, label, children }: { id: string; label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <label htmlFor={id} className="text-label uppercase text-muted-foreground">
      {label}
    </label>
    {children}
  </div>
);

export const inputClass =
  "rounded-md border border-input bg-card px-2 py-1 text-body text-foreground focus-visible:outline-2 focus-visible:outline-ring";

export const text = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value : fallback;
