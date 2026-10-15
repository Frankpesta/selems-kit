"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, m } from "framer-motion";
import type { RoomCard as RoomCardData } from "@/lib/data";
import { cn } from "@/lib/utils";
import { RoomCard } from "./RoomCard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fieldControl } from "./stay-shared";
import { EASE_OUT } from "@/components/motion/tokens";

// Filter chips + sort for /rooms, kept in the URL (?type=suite, ?max=50000,
// ?sort=price-desc). The server prerenders every room (crawlers see all of
// them, unfiltered); after mount the island reads the URL and updates it with
// history.replaceState, so filtering never reloads or re-renders the page.

type Filter = { key: string; label: string; match: (r: RoomCardData) => boolean; params: Record<string, string> };

export function RoomsBrowser({ rooms }: { rooms: RoomCardData[] }) {
  const [query, setQuery] = useState("");
  useEffect(() => {
    const sync = () => setQuery(window.location.search);
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  const params = new URLSearchParams(query);
  const type = params.get("type");
  const max = Number(params.get("max")) || null;
  const sort = params.get("sort") === "price-desc" ? "price-desc" : "price-asc";
  const go = (q: URLSearchParams) => {
    const s = q.toString();
    window.history.replaceState(null, "", s ? `?${s}` : window.location.pathname);
    setQuery(s ? `?${s}` : "");
  };

  const filters: Filter[] = [
    { key: "all", label: `All ${rooms.length}`, match: () => true, params: {} },
    { key: "room", label: "Rooms", match: (r) => r.category === "room", params: { type: "room" } },
    { key: "suite", label: "Suites", match: (r) => r.category === "suite", params: { type: "suite" } },
    { key: "max", label: "Under ₦50,000", match: (r) => r.baseRate < 5_000_000, params: { max: "50000" } },
  ];
  const active = type === "room" || type === "suite" ? type : max ? "max" : "all";
  const current = filters.find((f) => f.key === active)!;

  const shown = rooms
    .filter((r) => (max ? r.baseRate < max * 100 : true) && current.match(r))
    .sort((a, b) => (sort === "price-desc" ? b.baseRate - a.baseRate : a.baseRate - b.baseRate));

  const withSort = (next: Record<string, string>) => {
    const q = new URLSearchParams(next);
    if (sort === "price-desc") q.set("sort", "price-desc");
    return q;
  };

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
        <div role="group" aria-label="Filter rooms" className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <Link
              key={f.key}
              href={`/rooms${withSort(f.params).toString() ? `?${withSort(f.params)}` : ""}`}
              scroll={false}
              onClick={(e) => {
                e.preventDefault();
                go(withSort(f.params));
              }}
              aria-current={f.key === active ? "true" : undefined}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold no-underline transition-colors",
                f.key === active
                  ? "border-ink bg-ink text-white hover:text-white"
                  : "border-line-strong bg-paper text-ink hover:border-ink hover:text-ink",
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span id="rooms-sort-label" className="text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">
            Sort
          </span>
          <Select
            value={sort}
            onValueChange={(v) => {
              const q = new URLSearchParams(query);
              if (v === "price-desc") q.set("sort", "price-desc");
              else q.delete("sort");
              go(q);
            }}
          >
            <SelectTrigger aria-labelledby="rooms-sort-label" className={cn(fieldControl, "h-11 min-h-11 w-[210px]")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end" className="rounded-sm">
              <SelectItem value="price-asc" className="min-h-11">
                Price: low to high
              </SelectItem>
              <SelectItem value="price-desc" className="min-h-11">
                Price: high to low
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        Showing {shown.length} of {rooms.length} rooms
      </p>

      <m.ul className="m-0 grid list-none grid-cols-1 gap-x-6 gap-y-14 p-0 min-[760px]:grid-cols-2 min-[980px]:grid-cols-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {shown.map((r) => (
            <m.li
              key={r.slug}

              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.2 } }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
              className="flex"
            >
              <RoomCard room={r} headingLevel="h2" />
            </m.li>
          ))}
        </AnimatePresence>
      </m.ul>
    </div>
  );
}
