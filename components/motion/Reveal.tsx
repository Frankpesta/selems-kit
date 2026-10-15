"use client";

import { useLayoutEffect, useRef, type CSSProperties, type ElementType, type ReactNode } from "react";

// Fades and rises content as it scrolls into view, with CSS transitions and one
// shared IntersectionObserver (cheap to hydrate; no animation library).
//
// Content is server-rendered fully visible. Only elements that start *below the
// fold* when the page hydrates are hidden (while still off-screen) and then
// revealed, so nothing on screen ever disappears, crawlers and no-JS visitors
// see everything, and LCP is never delayed. Styles: [data-reveal] in globals.css.

let observer: IntersectionObserver | null = null;
const getObserver = () =>
  (observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        (e.target as HTMLElement).dataset.reveal = "shown";
        observer?.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -12% 0px" },
  ));

type Props = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "li" | "article" | "figure" | "section";
};

export function Reveal({ children, className, delay = 0, y = 28, as = "div" }: Props) {
  const ref = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top <= window.innerHeight) return;
    el.dataset.reveal = "hidden";
    getObserver().observe(el);
    return () => getObserver().unobserve(el);
  }, []);

  const Tag = as as ElementType;
  return (
    <Tag ref={ref} className={className} style={{ "--reveal-delay": `${delay}s`, "--reveal-y": `${y}px` } as CSSProperties}>
      {children}
    </Tag>
  );
}
