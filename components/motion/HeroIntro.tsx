import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

// First-load choreography for page heroes, in pure CSS (no JavaScript to
// hydrate). Transform-only on purpose: text and photos are painted, and count
// for LCP, from the first frame; they just settle into place. The global
// prefers-reduced-motion rule switches it off. Keyframes live in globals.css.

export function HeroRise({ children, order = 0, className }: { children: ReactNode; order?: number; className?: string }) {
  return (
    <div className={cn("anim-rise", className)} style={{ "--order": order } as CSSProperties}>
      {children}
    </div>
  );
}

export function HeroImage({ children, order = 0, className }: { children: ReactNode; order?: number; className?: string }) {
  return (
    <div className={cn("overflow-hidden", className)}>
      <div className="anim-settle h-full w-full" style={{ "--order": order } as CSSProperties}>
        {children}
      </div>
    </div>
  );
}
