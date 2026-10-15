"use client";

import { m, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Image drifts slower than the page as it scrolls past. The frame clips the
// image, which is scaled up just enough that its edges never show.
export function Parallax({
  children,
  className,
  strength = 0.08,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [`${-strength * 100}%`, `${strength * 100}%`]);

  return (
    <div ref={ref} className={cn("overflow-hidden", className)}>
      <m.div style={reduce ? undefined : { y, scale: 1 + strength * 2 }} className="h-full w-full will-change-transform">
        {children}
      </m.div>
    </div>
  );
}
