"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import { cn } from "@/lib/utils";
import { EASE_OUT } from "@/components/motion/tokens";
import { Lightbox } from "./Lightbox";

export type GalleryItem = {
  id: string;
  caption: string;
  category: "rooms" | "suites" | "dining" | "bar" | "hotel";
  room: { slug: string; name: string } | null;
  image: { url: string; alt: string; width: number; height: number };
};

const FILTERS = [
  { key: "all", label: "All", match: () => true },
  { key: "rooms", label: "Rooms", match: (g: GalleryItem) => g.category === "rooms" },
  { key: "suites", label: "Suites", match: (g: GalleryItem) => g.category === "suites" },
  { key: "dining", label: "Dining & bar", match: (g: GalleryItem) => g.category === "dining" || g.category === "bar" },
  { key: "hotel", label: "The hotel", match: (g: GalleryItem) => g.category === "hotel" },
] as const;

// Gallery (docs/05): crawlable filter links (?c=rooms; canonical stays
// /gallery), CSS-columns masonry with captions, and the shared lightbox. The
// server renders every photo; the URL filter is applied after mount.
export function GalleryBrowser({ items }: { items: GalleryItem[] }) {
  const [active, setActive] = useState<string>("all");
  const [openAt, setOpenAt] = useState<number | null>(null);
  useEffect(() => {
    const sync = () => {
      const c = new URLSearchParams(window.location.search).get("c");
      setActive(FILTERS.some((f) => f.key === c) ? c! : "all");
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  const filter = FILTERS.find((f) => f.key === active) ?? FILTERS[0];
  const shown = items.filter(filter.match);
  const counts = Object.fromEntries(FILTERS.map((f) => [f.key, items.filter(f.match).length]));

  return (
    <div className="flex flex-col gap-8">
      <div role="group" aria-label="Filter photos" className="flex flex-wrap gap-2">
        {FILTERS.filter((f) => counts[f.key] > 0).map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/gallery" : `/gallery?c=${f.key}`}
            scroll={false}
            aria-current={f.key === active ? "true" : undefined}
            onClick={(e) => {
              e.preventDefault();
              window.history.replaceState(null, "", f.key === "all" ? "/gallery" : `/gallery?c=${f.key}`);
              setActive(f.key);
            }}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold no-underline transition-colors",
              f.key === active
                ? "border-ink bg-ink text-white hover:text-white"
                : "border-line-strong bg-paper text-ink hover:border-ink hover:text-ink",
            )}
          >
            {f.label}
            <span className={cn("text-xs", f.key === active ? "text-white/70" : "text-muted-foreground")}>{counts[f.key]}</span>
          </Link>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        Showing {shown.length} photos
      </p>

      <ul className="m-0 list-none columns-1 gap-4 p-0 min-[560px]:columns-2 min-[980px]:columns-3">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((g, i) => (
            <m.li
              key={g.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
              transition={{ duration: 0.45, ease: EASE_OUT, delay: Math.min(i, 9) * 0.03 }}
              className="mb-4 break-inside-avoid"
            >
              <figure className="m-0">
                <button
                  type="button"
                  onClick={() => setOpenAt(i)}
                  aria-label={`View larger: ${g.image.alt}`}
                  className="group block w-full overflow-hidden"
                >
                  <Image
                    src={g.image.url}
                    alt={g.image.alt}
                    width={g.image.width}
                    height={g.image.height}
                    loading={i < 6 ? "eager" : "lazy"}
                    priority={i < 2}
                    sizes="(min-width: 980px) 410px, (min-width: 560px) 50vw, 100vw"
                    className="h-auto w-full transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                  />
                </button>
                <figcaption className="mt-2 flex items-baseline justify-between gap-3 text-sm">
                  <span>{g.caption}</span>
                  {g.room ? (
                    <Link href={`/rooms/${g.room.slug}`} className="font-semibold whitespace-nowrap">
                      View room
                      <span className="sr-only">: {g.room.name}</span>
                    </Link>
                  ) : null}
                </figcaption>
              </figure>
            </m.li>
          ))}
        </AnimatePresence>
      </ul>

      <Lightbox
        images={shown.map((g) => ({ ...g.image, caption: g.caption }))}
        label="Hotel photos"
        openAt={openAt}
        onClose={() => setOpenAt(null)}
      />
    </div>
  );
}
