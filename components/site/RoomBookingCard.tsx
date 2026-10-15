"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FunctionReturnType } from "convex/server";
import { AnimatePresence, m } from "framer-motion";
import { CheckCircle2Icon, CircleAlertIcon, LoaderIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { buttonVariants } from "@/components/ui/button";
import { convexQuery } from "@/lib/convex-http";
import { EASE_OUT } from "@/components/motion/tokens";
import { formatNaira } from "@/lib/money";
import { plural } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LazyStayPicker } from "./LazyStayPicker";
import type { Stay } from "./stay-shared";

export type BookingCardRoom = {
  slug: string;
  name: string;
  category: "room" | "suite";
  baseRate: number;
  weekendRate: number | null;
  maxAdults: number;
  maxChildren: number;
};

type Props = {
  room: BookingCardRoom;
  phone: { display: string; href: string };
  whatsapp: { display: string; href: string } | null;
  maxNights: number;
  windowDays: number;
};

const REASON: Record<string, [string, string]> = {
  standard: ["night", "nights"],
  weekend: ["weekend night", "weekend nights"],
  offer: ["night (offer)", "nights (offer)"],
};

type Quote = FunctionReturnType<typeof api.public.booking.quote>;

/** Live price + availability for one room (docs/05 "Room page"). */
export function RoomBookingCard({ room, phone, whatsapp, maxNights, windowDays }: Props) {
  const [stay, setStay] = useState<Stay>({
    checkIn: "",
    checkOut: "",
    adults: Math.min(2, room.maxAdults),
    children: 0,
  });
  const ready = !!(stay.checkIn && stay.checkOut);
  // Fetched once per change of dates/guests (no live connection on content pages).
  const key = ready ? `${stay.checkIn}|${stay.checkOut}|${stay.adults}|${stay.children}` : "";
  const [result, setResult] = useState<{ key: string; quote: Quote } | null>(null);
  useEffect(() => {
    if (!key) return;
    let live = true;
    const [checkIn, checkOut, adults, children] = key.split("|");
    convexQuery(api.public.booking.quote, {
      roomTypeSlug: room.slug,
      checkIn,
      checkOut,
      adults: Number(adults),
      children: Number(children),
    })
      .then((quote) => live && setResult({ key, quote }))
      .catch(() =>
        live &&
        setResult({ key, quote: { ok: false, error: { code: "UNKNOWN", message: "We couldn't check availability. Please try again or call us." } } }),
      );
    return () => {
      live = false;
    };
  }, [key, room.slug]);
  const quote = result && result.key === key ? result.quote : undefined;
  const kind = room.category === "suite" ? "suite" : "room";

  const reserveHref = `/book?${new URLSearchParams({
    room: room.slug,
    ...(ready ? { checkIn: stay.checkIn, checkOut: stay.checkOut } : {}),
    adults: String(stay.adults),
    children: String(stay.children),
  })}`;

  const ok = quote?.ok ? quote : null;
  const soldOut = ok && ok.available === 0;

  return (
    <aside
      id="book-card"
      aria-label={`Book the ${room.name}`}
      className="flex scroll-mt-28 flex-col gap-5 border border-line bg-paper p-6 shadow-[0_18px_40px_rgba(23,34,45,.08)] min-[980px]:sticky min-[980px]:top-[104px] min-[980px]:p-7"
    >
      <p className="m-0">
        <span className="font-display text-[40px] leading-none tabular-nums">{formatNaira(room.baseRate)}</span>{" "}
        <span className="text-muted-foreground">/ night</span>
        {room.weekendRate && room.weekendRate !== room.baseRate ? (
          <span className="mt-1 block text-sm text-muted-foreground">
            Fri &amp; Sat nights {formatNaira(room.weekendRate)}
          </span>
        ) : null}
      </p>

      <LazyStayPicker
        value={stay}
        onChange={setStay}
        idPrefix="rb"
        layout="stack"
        maxAdults={room.maxAdults}
        maxChildren={room.maxChildren}
        maxNights={maxNights}
        windowDays={windowDays}
      />

      <div aria-live="polite" className="min-h-6">
        <AnimatePresence mode="wait" initial={false}>
          {!ready ? (
            <m.p key="hint" {...fade} className="m-0 text-sm text-muted-foreground">
              Choose your dates to see the total for your stay.
            </m.p>
          ) : quote === undefined ? (
            <m.p key="loading" {...fade} className="m-0 flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderIcon className="size-4 animate-spin" aria-hidden="true" /> Checking availability…
            </m.p>
          ) : !quote.ok ? (
            <m.p key="error" {...fade} className="m-0 flex items-start gap-2 text-sm text-bad">
              <CircleAlertIcon className="mt-0.5 size-4 flex-none" aria-hidden="true" /> {quote.error.message}
            </m.p>
          ) : (
            <m.div key={`${stay.checkIn}-${stay.checkOut}`} {...fade} className="flex flex-col gap-3">
              <ul className="m-0 flex list-none flex-col p-0 text-sm tabular-nums">
                {ok!.groups.map((g) => {
                  const [one, many] = REASON[g.reason] ?? [`night (${g.reason})`, `nights (${g.reason})`];
                  return (
                    <li key={`${g.rate}-${g.reason}`} className="flex justify-between gap-4 border-t border-line py-2.5">
                      <span>
                        {formatNaira(g.rate)} × {g.count} {g.count === 1 ? one : many}
                      </span>
                      <span>{formatNaira(g.rate * g.count)}</span>
                    </li>
                  );
                })}
                {ok!.offer ? (
                  <li className="flex justify-between gap-4 border-t border-line py-2.5 text-velvet">
                    <span>{ok!.offer.title} applied</span>
                  </li>
                ) : null}
                <li className="flex justify-between gap-4 border-y border-line py-3 text-base font-semibold">
                  <span>Total for {plural(ok!.nights, "night")}</span>
                  <span>{formatNaira(ok!.total)}</span>
                </li>
              </ul>
              {ok!.taxNote ? <p className="m-0 text-xs text-muted-foreground">{ok!.taxNote}</p> : null}
              <p
                className={cn(
                  "m-0 flex items-center gap-2 text-sm font-semibold",
                  soldOut ? "text-bad" : ok!.available <= 2 ? "text-warn" : "text-ok",
                )}
              >
                {soldOut ? (
                  <CircleAlertIcon className="size-4" aria-hidden="true" />
                ) : (
                  <CheckCircle2Icon className="size-4" aria-hidden="true" />
                )}
                {soldOut
                  ? "Sold out for these dates. Try other dates or call us."
                  : ok!.available <= 2
                    ? `Only ${ok!.available} left for these dates`
                    : "Available for these dates"}
              </p>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      <Link
        href={reserveHref}
        aria-disabled={soldOut || undefined}
        className={cn(buttonVariants({ variant: "amber", size: "cta" }), "w-full", soldOut && "pointer-events-none opacity-50")}
      >
        {ready ? `Reserve this ${kind}` : "Check dates and reserve"}
      </Link>
      <p className="m-0 text-center text-sm text-muted-foreground">No payment now. Pay at the hotel on arrival.</p>
      <hr className="m-0 border-line" />
      <p className="m-0 text-sm">
        Prefer to talk? Call{" "}
        <a href={phone.href} className="font-semibold tabular-nums">
          {phone.display}
        </a>
        {whatsapp ? (
          <>
            {" "}or{" "}
            <a href={whatsapp.href} className="font-semibold">
              WhatsApp us
            </a>
          </>
        ) : null}
        .
      </p>
    </aside>
  );
}

const fade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.3, ease: EASE_OUT },
};
