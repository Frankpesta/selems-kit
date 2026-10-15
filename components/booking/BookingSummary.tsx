"use client";

import Image from "next/image";
import { formatNaira } from "@/lib/money";
import { formatDate, formatParty, plural } from "@/lib/format";
import type { HotelInfo } from "./types";

export type SummaryRoom = {
  name: string;
  cover: { url: string; alt: string; width: number; height: number } | null;
  groups: { rate: number; reason: string; count: number }[];
  total: number;
  offer: { title: string } | null;
};

const REASON: Record<string, [string, string]> = {
  standard: ["night", "nights"],
  weekend: ["weekend night", "weekend nights"],
  offer: ["night (offer)", "nights (offer)"],
};

/** "Your stay" card: sticky on desktop, a collapsible bar on phones (docs/05). */
export function BookingSummary({
  room,
  checkIn,
  checkOut,
  nights,
  adults,
  childCount: children,
  hotel,
}: {
  room: SummaryRoom | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  adults: number;
  childCount: number;
  hotel: HotelInfo;
}) {
  const hasDates = !!(checkIn && checkOut && nights > 0);
  const body = (
    <div className="flex flex-col gap-4">
      {room?.cover ? (
        <Image
          src={room.cover.url}
          alt={room.cover.alt}
          width={room.cover.width}
          height={room.cover.height}
          sizes="360px"
          className="aspect-[16/10] w-full object-cover"
        />
      ) : null}
      {room ? <h2 className="font-display m-0 text-[28px]">{room.name}</h2> : null}
      <dl className="m-0 text-sm tabular-nums">
        <Row label="Check-in" value={hasDates ? `${formatDate(checkIn)}${hotel.checkInTime ? `, from ${hotel.checkInTime}` : ""}` : "Choose dates"} />
        <Row label="Check-out" value={hasDates ? `${formatDate(checkOut)}${hotel.checkOutTime ? `, by ${hotel.checkOutTime}` : ""}` : "–"} />
        {hasDates ? <Row label="Length of stay" value={plural(nights, "night")} /> : null}
        <Row label="Guests" value={formatParty(adults, children)} />
        {room
          ? room.groups.map((g) => {
              const [one, many] = REASON[g.reason] ?? [`night (${g.reason})`, `nights (${g.reason})`];
              return (
                <Row
                  key={`${g.rate}-${g.reason}`}
                  label={`${formatNaira(g.rate)} × ${g.count} ${g.count === 1 ? one : many}`}
                  value={formatNaira(g.rate * g.count)}
                />
              );
            })
          : null}
        {room?.offer ? <Row label="Offer" value={room.offer.title} /> : null}
        {room ? (
          <div className="flex justify-between gap-4 border-y border-line py-3 text-base font-semibold">
            <dt>Total, pay at the hotel</dt>
            <dd className="m-0">{formatNaira(room.total)}</dd>
          </div>
        ) : null}
      </dl>
      {hotel.taxNote ? <p className="m-0 text-xs text-muted-foreground">{hotel.taxNote}</p> : null}
      <p className="m-0 text-sm text-muted-foreground">
        {hotel.cancellationPolicy ?? "No payment now. You pay at the front desk when you arrive."}
      </p>
    </div>
  );

  return (
    <>
      {/* Phones: collapsible summary above the form */}
      <details className="group border border-line bg-paper min-[980px]:hidden">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-4 [&::-webkit-details-marker]:hidden">
          <span className="text-sm">
            <span className="font-semibold">{room?.name ?? "Your stay"}</span>
            {hasDates ? <span className="text-muted-foreground"> · {plural(nights, "night")}</span> : null}
          </span>
          <span className="flex items-center gap-2 font-semibold tabular-nums">
            {room ? formatNaira(room.total) : null}
            <span aria-hidden="true" className="text-amber transition-transform group-open:rotate-180">
              ▾
            </span>
          </span>
        </summary>
        <div className="border-t border-line p-4">{body}</div>
      </details>
      {/* Desktop: sticky card */}
      <aside
        aria-label="Booking summary"
        className="sticky top-6 hidden flex-col gap-4 border border-line bg-paper p-6 shadow-[0_18px_40px_rgba(23,34,45,.06)] min-[980px]:flex"
      >
        <p className="eyebrow m-0">Your stay</p>
        {body}
      </aside>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-t border-line py-2.5">
      <dt className="text-body">{label}</dt>
      <dd className="m-0 text-right">{value}</dd>
    </div>
  );
}
