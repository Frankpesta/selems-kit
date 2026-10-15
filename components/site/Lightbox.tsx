"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { AnimatePresence, m } from "framer-motion";
import { EASE_OUT } from "@/components/motion/tokens";

export type LightboxImage = { url: string; alt: string; width: number; height: number; caption?: string };

// Full-screen photo viewer on a native <dialog> (focus trap, Esc), with arrow
// keys, swipe and a live "3 / 19" counter. Open it by setting `openAt`.
export function Lightbox({
  images,
  label,
  openAt,
  onClose,
}: {
  images: LightboxImage[];
  label: string;
  openAt: number | null;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [shownFor, setShownFor] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);
  const count = images.length;

  // Sync the requested index during render, then open the dialog in an effect.
  if (openAt !== shownFor) {
    setShownFor(openAt);
    if (openAt !== null) setIndex(openAt);
  }
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (openAt !== null && !el.open) el.showModal();
    if (openAt === null && el.open) el.close();
  }, [openAt]);

  const step = useCallback(
    (d: number) => {
      setDir(d);
      setIndex((i) => (i + d + count) % count);
    },
    [count],
  );

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [step]);

  if (count === 0) return null;
  const img = images[Math.min(index, count - 1)];

  return (
    <dialog
      ref={dialog}
      aria-label={label}
      onClose={onClose}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-ink-2/95 p-0 text-stone backdrop:bg-ink-2/80"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 py-3 min-[760px]:px-8">
          <p className="m-0 text-sm tabular-nums" aria-live="polite">
            {index + 1} / {count}
          </p>
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close photos"
            className="inline-flex size-11 items-center justify-center rounded-full text-stone hover:bg-white/10"
          >
            <XIcon className="size-6" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-4 min-[760px]:px-20">
          <AnimatePresence initial={false} custom={dir} mode="popLayout">
            <m.figure
              key={index}
              initial={{ opacity: 0, x: dir * 60 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -60 }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
              className="m-0 flex h-full max-h-full flex-col items-center justify-center gap-3"
            >
              <Image
                src={img.url}
                alt={img.alt}
                width={img.width}
                height={img.height}
                sizes="100vw"
                className="max-h-[calc(100dvh-140px)] w-auto object-contain"
              />
              <figcaption className="text-center text-sm text-[#C9D3D9]">{img.caption ?? img.alt}</figcaption>
            </m.figure>
          </AnimatePresence>
          {count > 1 ? (
            <>
              <button
                type="button"
                onClick={() => step(-1)}
                aria-label="Previous photo"
                className="absolute top-1/2 left-2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-stone hover:bg-black/50 min-[760px]:left-6"
              >
                <ChevronLeftIcon className="size-6" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                aria-label="Next photo"
                className="absolute top-1/2 right-2 inline-flex size-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/30 text-stone hover:bg-black/50 min-[760px]:right-6"
              >
                <ChevronRightIcon className="size-6" aria-hidden="true" />
              </button>
            </>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
