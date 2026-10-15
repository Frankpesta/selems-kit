"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";

// Phones only: fixed bottom bar with the lowest rate and a Book button (docs/02).
// Hidden on the booking flow and on room pages (they render their own bar).
export function MobileBookBar({ fromRate }: { fromRate: string }) {
  const pathname = usePathname();
  if (pathname.startsWith("/book") || /^\/rooms\/[^/]+$/.test(pathname)) return null;
  return (
    <>
      <div aria-hidden="true" className="h-[calc(76px+env(safe-area-inset-bottom))] min-[760px]:hidden" />
      <div className="animate-glide-up fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] min-[760px]:hidden">
        <div className="container-site flex h-[76px] items-center justify-between gap-4">
          <p className="m-0 text-sm text-body">
            From <span className="font-semibold text-ink tabular-nums">{fromRate}</span> / night
          </p>
          <Link href="/book" className={buttonVariants({ variant: "amber", size: "cta" })}>
            Book a room
          </Link>
        </div>
      </div>
    </>
  );
}
