"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAction, useMutation, useQuery } from "convex/react";
import { MailIcon, MessageCircleIcon, PhoneIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDateShort, formatParty, formatPhone, plural } from "@/lib/format";
import { groupNightly } from "@/convex/lib/pricing";
import { Btn, KeyValues, Loading, Pill, Textarea, btnClass } from "../ui";
import { METHODS, PAYMENT, STATUS, formatStamp, naira, sourceLabel, useRun, whatsappLink } from "../lib";
import {
  CancelDialog,
  ChangeDatesDialog,
  CheckOutDialog,
  EditGuestDialog,
  MoveRoomDialog,
  NoShowDialog,
  RecordPaymentDialog,
} from "./dialogs";

// One booking: contact, stay, money, history and every action (docs/06).

type Dialog = "pay" | "checkout" | "cancel" | "noshow" | "dates" | "move" | "guest" | null;

const REASON: Record<string, string> = { standard: "night", weekend: "weekend night", offer: "night (offer)", manual: "night (special rate)" };
const unit = (reason: string, count: number) => {
  const u = REASON[reason] ?? `night (${reason})`;
  return count === 1 ? u : u.replace("night", "nights");
};

export function ReservationDetail({ id, compact }: { id: Id<"bookings">; compact?: boolean }) {
  const b = useQuery(api.admin.reservations.get, { id });
  const markViewed = useMutation(api.admin.reservations.markViewed);
  const checkIn = useMutation(api.admin.reservations.checkIn);
  const resend = useAction(api.admin.reservations.resendConfirmation);
  const addNote = useMutation(api.admin.reservations.addNote);
  const { run, pending } = useRun();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [note, setNote] = useState("");

  const unviewed = b && !b.viewed;
  useEffect(() => {
    if (unviewed) void markViewed({ id }).catch(() => undefined);
  }, [unviewed, id, markViewed]);

  if (b === undefined) return <Loading />;
  if (b === null) return <p className="m-0 p-5 text-sm text-muted">This booking doesn&rsquo;t exist.</p>;

  const summary = { ...b, hasEmail: !!b.guestDetails.email };
  const close = (o: boolean) => !o && setDialog(null);
  const s = STATUS[b.status];

  async function submitNote(e: FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    const ok = await run(() => addNote({ id, message: note }), "Note added");
    if (ok !== undefined) setNote("");
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 text-xl font-semibold">{b.guest}</p>
          <p className="m-0 text-sm text-muted">
            {b.ref} · {sourceLabel(b.source)}
            {b.createdBy ? ` · by ${b.createdBy}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Pill tone={s.tone}>{s.label}</Pill>
          <Pill tone={PAYMENT[b.paymentStatus].tone}>{PAYMENT[b.paymentStatus].label}</Pill>
        </div>
      </div>

      {b.attention ? <p className="m-0 rounded-md bg-warn-bg px-3 py-2 text-sm font-medium text-warn">{b.attention}</p> : null}

      <div className="flex flex-wrap gap-2">
        <a className={btnClass("default")} href={`tel:${b.guestDetails.phone}`}>
          <PhoneIcon aria-hidden /> {formatPhone(b.guestDetails.phone)}
        </a>
        <a className={btnClass("default")} href={whatsappLink(b.guestDetails.phone)} target="_blank" rel="noreferrer">
          <MessageCircleIcon aria-hidden /> WhatsApp
        </a>
        {b.guestDetails.email ? (
          <a className={btnClass("default")} href={`mailto:${b.guestDetails.email}`}>
            <MailIcon aria-hidden /> Email
          </a>
        ) : null}
      </div>

      <KeyValues
        rows={[
          ["Room", `${b.roomType}, room ${b.roomNumber}`],
          ["Dates", `${formatDateShort(b.checkIn)} – ${formatDateShort(b.checkOut)} (${plural(b.nights, "night")})`],
          ["Guests", formatParty(b.adults, b.children)],
          ["Email", b.guestDetails.email || <span className="text-muted">None</span>],
          ["Arriving", b.arrivalWindow],
          ["Purpose", b.purpose ? b.purpose[0].toUpperCase() + b.purpose.slice(1) : null],
          ["Requests", b.specialRequests],
          ["Offer", b.offerTitle],
          ["Cancelled", b.cancelledReason],
        ]}
      />

      {/* Actions */}
      <div className="grid grid-cols-2 gap-2">
        {b.canCheckIn ? (
          <Btn variant="dark" disabled={pending} onClick={() => run(() => checkIn({ id }), `${b.guest} checked in to ${b.roomNumber}`)}>
            Check in
          </Btn>
        ) : null}
        {b.canCheckOut ? (
          <Btn variant="dark" onClick={() => setDialog("checkout")}>
            Check out
          </Btn>
        ) : null}
        {b.balance > 0 && b.status !== "cancelled" ? <Btn onClick={() => setDialog("pay")}>Record payment</Btn> : null}
        {b.canChange ? <Btn onClick={() => setDialog("dates")}>Change dates</Btn> : null}
        {b.canChange ? <Btn onClick={() => setDialog("move")}>Move room</Btn> : null}
        <Btn onClick={() => setDialog("guest")}>Edit guest</Btn>
        {b.guestDetails.email && b.canChange ? (
          <Btn disabled={pending} onClick={() => run(() => resend({ id }), (r) => `Confirmation sent to ${r.email}`)}>
            Resend confirmation
          </Btn>
        ) : null}
        {b.canNoShow ? (
          <Btn variant="danger" onClick={() => setDialog("noshow")}>
            Mark no-show
          </Btn>
        ) : null}
        {b.canCancel ? (
          <Btn variant="danger" onClick={() => setDialog("cancel")}>
            Cancel booking
          </Btn>
        ) : null}
      </div>

      {/* Money */}
      <section aria-labelledby={`price-${id}`} className="flex flex-col gap-2 border-t border-[#EEF0F0] pt-4">
        <h3 id={`price-${id}`} className="m-0 text-sm font-semibold">
          Price
        </h3>
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm tabular-nums">
          {groupNightly(b.nightly).map((g) => (
            <li key={`${g.rate}-${g.reason}`} className="flex justify-between gap-3">
              <span className="text-body">
                {naira(g.rate)} × {g.count} {unit(g.reason, g.count)}
              </span>
              <span>{naira(g.rate * g.count)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 border-t border-[#EEF0F0] pt-1 font-semibold">
            <span>Total</span>
            <span>{naira(b.amountDue)}</span>
          </li>
          {b.payments.map((p) => (
            <li key={p.id} className="flex justify-between gap-3 text-ok">
              <span>
                Paid {formatStamp(p.at)}, {METHODS.find((m) => m.value === p.method)?.label}
                {p.note ? ` (${p.note})` : ""} · {p.by}
              </span>
              <span>−{naira(p.amount)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-3 border-t border-[#EEF0F0] pt-1 font-semibold">
            <span>Balance</span>
            <span className={b.balance > 0 ? "text-bad" : "text-ok"}>{naira(b.balance)}</span>
          </li>
        </ul>
      </section>

      {/* History */}
      <section aria-labelledby={`hist-${id}`} className="flex flex-col gap-2 border-t border-[#EEF0F0] pt-4">
        <h3 id={`hist-${id}`} className="m-0 text-sm font-semibold">
          History and notes
        </h3>
        <form onSubmit={submitNote} className="flex flex-col gap-2">
          <label htmlFor={`note-${id}`} className="sr-only">
            Add an internal note
          </label>
          <Textarea id={`note-${id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add an internal note (guests never see these)" maxLength={1000} className="min-h-16" />
          <Btn type="submit" className="self-end" disabled={pending || !note.trim()}>
            Add note
          </Btn>
        </form>
        <ol className="m-0 flex list-none flex-col gap-2 p-0 text-[13px]">
          {b.events.map((e) => (
            <li key={e.id} className={e.type === "note" ? "rounded-md bg-[#FBF5EF] px-3 py-2" : "text-muted"}>
              <span className="text-muted">{formatStamp(e.at)}</span>
              {e.type === "note" && e.by ? <strong className="text-ink"> · {e.by}</strong> : null} · <span className={e.type === "note" ? "text-ink" : ""}>{e.message}</span>
            </li>
          ))}
        </ol>
      </section>

      {compact ? (
        <Link href={`/admin/reservations/${id}`} className="text-sm font-semibold">
          Open full page
        </Link>
      ) : null}

      {dialog === "pay" ? <RecordPaymentDialog open onOpenChange={close} booking={summary} /> : null}
      {dialog === "checkout" ? <CheckOutDialog open onOpenChange={close} booking={summary} today={b.today} /> : null}
      <CancelDialog open={dialog === "cancel"} onOpenChange={close} booking={summary} />
      <NoShowDialog open={dialog === "noshow"} onOpenChange={close} booking={summary} />
      {dialog === "dates" ? <ChangeDatesDialog open onOpenChange={close} booking={summary} checkedIn={b.status === "checked_in"} /> : null}
      {dialog === "move" ? <MoveRoomDialog open onOpenChange={close} booking={summary} /> : null}
      {dialog === "guest" ? <EditGuestDialog open onOpenChange={close} booking={b} /> : null}
    </div>
  );
}
