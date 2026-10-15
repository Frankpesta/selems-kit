"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LazyStayPicker } from "./LazyStayPicker";
import type { Stay } from "./stay-shared";

// Dates + guests → /book (docs/02). Overlaps the hero bottom.
export function AvailabilityBar({ className }: { className?: string }) {
  const router = useRouter();
  const [stay, setStay] = useState<Stay>({ checkIn: "", checkOut: "", adults: 2, children: 0 });

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams({ adults: String(stay.adults), children: String(stay.children) });
    if (stay.checkIn && stay.checkOut) {
      params.set("checkIn", stay.checkIn);
      params.set("checkOut", stay.checkOut);
    }
    router.push(`/book?${params.toString()}`);
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Check room availability"
      className={cn(
        "relative grid grid-cols-1 items-end gap-4 border border-line bg-paper p-6 shadow-[0_18px_40px_rgba(23,34,45,.12)] min-[980px]:grid-cols-[minmax(0,1fr)_auto]",
        className,
      )}
    >
      <LazyStayPicker value={stay} onChange={setStay} idPrefix="ab" />
      <button type="submit" className={buttonVariants({ variant: "amber", size: "cta" })}>
        Check availability
      </button>
    </form>
  );
}
