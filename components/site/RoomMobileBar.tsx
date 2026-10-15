"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { buttonVariants } from "@/components/ui/button";

const noop = () => () => {};
const useMounted = () => useSyncExternalStore(noop, () => true, () => false);

// Phones: sticky "₦70,000 per night · Choose dates" bar on room pages. Jumps to
// the booking card and opens the date picker. Rendered into <body> so the page
// transition's transform can't turn "fixed" into "relative to the page" (CLS).
export function RoomMobileBar({ rate }: { rate: string }) {
  const mounted = useMounted();
  return (
    <>
      <div aria-hidden="true" className="h-[calc(76px+env(safe-area-inset-bottom))] min-[980px]:hidden" />
      {mounted ? createPortal(<Bar rate={rate} />, document.body) : null}
    </>
  );
}

function Bar({ rate }: { rate: string }) {
  return (
      <div className="animate-glide-up fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] min-[980px]:hidden">
        <div className="container-site flex h-[76px] items-center justify-between gap-4">
          <p className="m-0 text-sm text-body">
            <span className="font-semibold text-ink tabular-nums">{rate}</span> per night
          </p>
          <button
            type="button"
            className={buttonVariants({ variant: "amber", size: "cta" })}
            onClick={() => {
              const card = document.getElementById("book-card");
              card?.scrollIntoView({ behavior: "smooth", block: "start" });
              window.setTimeout(() => card?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.click(), 450);
            }}
          >
            Choose dates
          </button>
        </div>
      </div>
  );
}
