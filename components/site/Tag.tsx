import type { ReactNode } from "react";

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block bg-amber-soft px-2 py-1 text-[11.5px] leading-none font-semibold tracking-[0.08em] text-amber-dark uppercase">
      {children}
    </span>
  );
}
