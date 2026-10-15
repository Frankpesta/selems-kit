"use client";

import { animate, useInView, useReducedMotion } from "framer-motion";
import { useLayoutEffect, useMemo, useRef } from "react";
import { EASE_OUT } from "./tokens";

// Counts the number inside a figure up from zero when it scrolls into view
// ("9", "₦35k", "24/7" keeps its "/7"). Server HTML holds the final value.
export function CountUp({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { once: true, margin: "0px 0px -10% 0px" });
  const match = useMemo(() => /^(\D*)(\d+)(.*)$/.exec(value), [value]);
  const armed = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || reduce || !match) return;
    if (el.getBoundingClientRect().top > window.innerHeight) {
      armed.current = true;
      el.textContent = `${match[1]}0${match[3]}`;
    }
  }, [reduce, match]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!inView || !el || !match || !armed.current) return;
    const [, pre, num, post] = match;
    const controls = animate(0, Number(num), {
      duration: 1.4,
      ease: EASE_OUT,
      onUpdate: (v) => {
        el.textContent = `${pre}${Math.round(v)}${post}`;
      },
    });
    return () => controls.stop();
  }, [inView, match]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
