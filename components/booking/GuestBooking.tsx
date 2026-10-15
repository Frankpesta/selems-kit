"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, m } from "framer-motion";
import { CircleAlertIcon, LoaderIcon, MapPinIcon, MessageCircleIcon, PhoneIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { buttonVariants } from "@/components/ui/button";
import { EASE_OUT } from "@/components/motion/tokens";
import { formatDate, formatParty, formatTime, plural } from "@/lib/format";
import { formatNaira } from "@/lib/money";
import { toAppError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { HotelInfo } from "./types";

const STATUS: Record<string, { label: string; tone: string }> = {
  reserved: { label: "Reserved", tone: "bg-info-bg text-info" },
  checked_in: { label: "Checked in", tone: "bg-ok-bg text-ok" },
  checked_out: { label: "Checked out", tone: "bg-mist text-body" },
  cancelled: { label: "Cancelled", tone: "bg-bad-bg text-bad" },
  no_show: { label: "No-show", tone: "bg-bad-bg text-bad" },
};

const deadlineFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "Africa/Lagos",
});

/** The guest's own booking page, opened from the confirmation email (docs/05). */
export function GuestBooking({ hotel }: { hotel: HotelInfo }) {
  const { ref } = useParams<{ ref: string }>();
  const token = useSearchParams().get("t") ?? "";
  const booking = useQuery(api.public.booking.forGuest, token ? { ref, token } : "skip");
  const cancel = useMutation(api.public.booking.cancelByGuest);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justCancelled, setJustCancelled] = useState(false);

  if (token && booking === undefined) {
    return (
      <p className="flex items-center gap-2 text-muted-foreground" aria-busy="true">
        <LoaderIcon className="size-4 animate-spin" aria-hidden="true" /> Loading your booking…
      </p>
    );
  }

  if (!token || !booking) {
    return (
      <div className="flex flex-col gap-5 border border-line bg-paper p-8">
        <h1 className="font-display m-0 text-[40px]">We couldn&rsquo;t find that booking</h1>
        <p className="m-0 text-body">
          The link may be incomplete. Open it again from your confirmation email, or contact the front office with
          your booking reference and we&rsquo;ll help straight away.
        </p>
        <Contacts hotel={hotel} />
      </div>
    );
  }

  const status = STATUS[booking.status] ?? STATUS.reserved;

  async function doCancel() {
    setBusy(true);
    setError(null);
    try {
      await cancel({ ref, token });
      setJustCancelled(true);
      setConfirming(false);
    } catch (e) {
      setError(toAppError(e).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <p className="eyebrow m-0">Booking {booking.ref}</p>
        <h1 className="font-display m-0 text-[40px] min-[760px]:text-[52px]">
          {booking.status === "cancelled" ? "This booking is cancelled" : `Your stay, ${booking.guest.firstName}`}
        </h1>
        <span className={cn("self-start rounded-full px-3 py-1 text-sm font-semibold", status.tone)}>{status.label}</span>
      </div>

      <AnimatePresence>
        {justCancelled ? (
          <m.p
            role="status"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="m-0 border border-ok/30 bg-ok-bg px-4 py-3 text-ok"
          >
            Your booking is cancelled and the room has been released. We&rsquo;ve emailed you a confirmation.
          </m.p>
        ) : null}
      </AnimatePresence>

      <div className="grid grid-cols-1 items-start gap-8 min-[760px]:grid-cols-[minmax(0,1fr)_320px]">
        <dl className="m-0 border border-line bg-paper px-5 text-[15px]">
          {(
            [
              ["Room", booking.room?.name ?? ""],
              ["Check-in", `${formatDate(booking.checkIn)}${booking.checkInTime ? `, from ${formatTime(booking.checkInTime)}` : ""}`],
              ["Check-out", `${formatDate(booking.checkOut)}${booking.checkOutTime ? `, by ${formatTime(booking.checkOutTime)}` : ""}`],
              ["Length of stay", plural(booking.nights, "night")],
              ["Guests", formatParty(booking.adults, booking.children)],
              ["Total", formatNaira(booking.amountDue)],
              ["Paid so far", booking.amountPaid > 0 ? formatNaira(booking.amountPaid) : ""],
              ["Due at the hotel", booking.status === "cancelled" ? "" : formatNaira(booking.balance)],
            ] as [string, string][]
          )
            .filter(([, v]) => v)
            .map(([k, v], i) => (
              <div key={k} className={cn("flex justify-between gap-4 py-3", i > 0 && "border-t border-line")}>
                <dt className="text-body">{k}</dt>
                <dd className="m-0 text-right font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
        </dl>
        {booking.room?.cover ? (
          <Image
            src={booking.room.cover.url}
            alt={booking.room.cover.alt}
            width={booking.room.cover.width}
            height={booking.room.cover.height}
            sizes="320px"
            className="aspect-[4/3] w-full object-cover"
          />
        ) : null}
      </div>

      {booking.cancellationPolicy ? <p className="m-0 text-sm text-body">{booking.cancellationPolicy}</p> : null}

      {booking.canCancel && !justCancelled ? (
        <div className="flex flex-col gap-4 border border-line bg-paper p-6">
          <AnimatePresence mode="wait" initial={false}>
            {!confirming ? (
              <m.div key="ask" {...fade} className="flex flex-wrap items-center justify-between gap-4">
                <p className="m-0 text-body">
                  Plans changed? You can cancel online until {deadlineFmt.format(booking.cancelDeadline)}.
                </p>
                <button type="button" onClick={() => setConfirming(true)} className={buttonVariants({ variant: "line", size: "cta" })}>
                  Cancel booking
                </button>
              </m.div>
            ) : (
              <m.div key="confirm" {...fade} role="alertdialog" aria-labelledby="cancel-q" className="flex flex-col gap-4">
                <p id="cancel-q" className="m-0 font-semibold">
                  Cancel {booking.ref}? Your {booking.room?.name ?? "room"} for {formatDate(booking.checkIn)} will be released
                  and can&rsquo;t be held again online.
                </p>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => setConfirming(false)} className={buttonVariants({ variant: "line", size: "cta" })}>
                    Keep my booking
                  </button>
                  <button
                    type="button"
                    onClick={doCancel}
                    disabled={busy}
                    className={cn(buttonVariants({ variant: "amber", size: "cta" }), "bg-bad hover:bg-[#82211a]")}
                  >
                    {busy ? <LoaderIcon className="size-4 animate-spin" aria-hidden="true" /> : null} Yes, cancel it
                  </button>
                </div>
              </m.div>
            )}
          </AnimatePresence>
          {error ? (
            <p role="alert" className="m-0 flex items-start gap-2 text-sm text-bad">
              <CircleAlertIcon className="mt-0.5 size-4 flex-none" aria-hidden="true" /> {error}
            </p>
          ) : null}
        </div>
      ) : booking.status === "reserved" && !justCancelled ? (
        <p className="m-0 text-body">To change or cancel this booking now, call or WhatsApp the front office.</p>
      ) : null}

      <div className="flex flex-col gap-3">
        <h2 className="font-display m-0 text-[28px]">Contact the hotel</h2>
        <Contacts hotel={hotel} />
      </div>
      <div>
        <Link href="/" className="font-semibold">
          Back to the Selems website
        </Link>
      </div>
    </div>
  );
}

function Contacts({ hotel }: { hotel: HotelInfo }) {
  return (
    <div className="flex flex-wrap gap-3">
      <a href={hotel.phone.href} className={buttonVariants({ variant: "line", size: "cta" })}>
        <PhoneIcon className="size-4" aria-hidden="true" /> {hotel.phone.display}
      </a>
      {hotel.whatsapp ? (
        <a href={hotel.whatsapp.href} className={buttonVariants({ variant: "line", size: "cta" })}>
          <MessageCircleIcon className="size-4" aria-hidden="true" /> WhatsApp
        </a>
      ) : null}
      <a href={hotel.mapsHref} target="_blank" rel="noopener" className={buttonVariants({ variant: "line", size: "cta" })}>
        <MapPinIcon className="size-4" aria-hidden="true" /> Directions
      </a>
    </div>
  );
}

const fade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
  transition: { duration: 0.3, ease: EASE_OUT },
};
