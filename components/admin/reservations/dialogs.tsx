"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addDays, nightsBetween, todayLagos } from "@/lib/dates";
import { formatDateShort, plural } from "@/lib/format";
import { Btn, Checkbox, FormField, Input, Textarea } from "../ui";
import { Choice, DateField } from "../pickers";
import { METHODS, SOURCES, errorField, errorText, naira, nairaInput, toKobo, useRun } from "../lib";

// Dialogs for every reservation action (docs/06). Each shows the consequence
// before staff confirm, and reports the outcome in a toast.

type Open = { open: boolean; onOpenChange: (o: boolean) => void };

function Shell({ open, onOpenChange, title, description, children, wide }: Open & { title: string; description?: ReactNode; children: ReactNode; wide?: boolean }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={wide ? "max-h-[92dvh] overflow-y-auto sm:max-w-2xl" : "max-h-[92dvh] overflow-y-auto sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">{title}</DialogTitle>
          {description ? <DialogDescription className="text-sm text-body">{description}</DialogDescription> : null}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function Actions({ children }: { children: ReactNode }) {
  return <DialogFooter className="mt-2 flex-row flex-wrap justify-end gap-2">{children}</DialogFooter>;
}

export type BookingSummary = {
  id: Id<"bookings">;
  ref: string;
  guest: string;
  roomType: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  balance: number;
  amountDue: number;
  hasEmail?: boolean;
};

const dates = (b: Pick<BookingSummary, "checkIn" | "checkOut">) => `${formatDateShort(b.checkIn)} – ${formatDateShort(b.checkOut)}`;

// ─── Record payment ──────────────────────────────────────────────────────────

export function RecordPaymentDialog({ booking, ...o }: Open & { booking: BookingSummary }) {
  const record = useMutation(api.admin.reservations.recordPayment);
  const { run, pending } = useRun();
  const [amount, setAmount] = useState(nairaInput(booking.balance));
  const [method, setMethod] = useState<(typeof METHODS)[number]["value"]>("cash");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const kobo = toKobo(amount);
    if (!kobo) return setErr("Enter the amount received, e.g. 35,000.");
    const r = await run(() => record({ id: booking.id, amount: kobo, method, note: note || undefined }), (r) =>
      r.balance ? `${naira(kobo)} recorded. ${naira(r.balance)} still due.` : `${naira(kobo)} recorded. Fully paid.`,
    );
    if (r) o.onOpenChange(false);
  }

  return (
    <Shell {...o} title={`Record payment · ${booking.ref}`} description={`${booking.guest}. Balance due: ${naira(booking.balance)}.`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <FormField label="Amount received (₦)" error={err}>
          {(p) => <Input {...p} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus className="tabular-nums" />}
        </FormField>
        <FormField label="How they paid">
          {(p) => (
            <Choice {...p} value={method} onChange={(v) => setMethod(v as typeof method)} options={[...METHODS]} />
          )}
        </FormField>
        <FormField label="Note (optional)" hint="Transfer reference, POS slip number…">
          {(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />}
        </FormField>
        <Actions>
          <Btn onClick={() => o.onOpenChange(false)}>Cancel</Btn>
          <Btn type="submit" variant="primary" disabled={pending}>
            Record payment
          </Btn>
        </Actions>
      </form>
    </Shell>
  );
}

// ─── Check out ───────────────────────────────────────────────────────────────

export function CheckOutDialog({ booking, today, ...o }: Open & { booking: BookingSummary; today: string }) {
  const checkOut = useMutation(api.admin.reservations.checkOut);
  const { run, pending } = useRun();
  const [reason, setReason] = useState("");
  const owing = booking.balance > 0;
  const early = today < booking.checkOut;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (owing && !reason.trim()) return;
    const r = await run(() => checkOut({ id: booking.id, overrideReason: owing ? reason : undefined }), `${booking.guest} checked out of ${booking.roomNumber}`);
    if (r !== undefined) o.onOpenChange(false);
  }
  return (
    <Shell
      {...o}
      title={`Check out ${booking.guest}?`}
      description={
        <>
          Room {booking.roomNumber}, {dates(booking)}.
          {early ? ` They're leaving early: nights from ${formatDateShort(today)} will be released for new bookings.` : null}
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        {owing ? (
          <div className="rounded-md bg-warn-bg px-3 py-2.5 text-sm text-warn">
            <strong>{naira(booking.balance)} is still due.</strong> Record the payment first, or give a reason to check out anyway.
          </div>
        ) : null}
        {owing ? (
          <FormField label="Reason to check out with a balance">
            {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required placeholder="e.g. Company paying by transfer on Monday" />}
          </FormField>
        ) : null}
        <Actions>
          <Btn onClick={() => o.onOpenChange(false)}>Back</Btn>
          <Btn type="submit" variant="dark" disabled={pending || (owing && !reason.trim())}>
            {owing ? "Check out anyway" : "Check out"}
          </Btn>
        </Actions>
      </form>
    </Shell>
  );
}

// ─── Cancel / no-show ───────────────────────────────────────────────────────

export function CancelDialog({ booking, ...o }: Open & { booking: BookingSummary }) {
  const cancel = useMutation(api.admin.reservations.cancel);
  const { run, pending } = useRun();
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(true);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await run(() => cancel({ id: booking.id, reason, notifyGuest: notify }), `${booking.ref} cancelled. Room ${booking.roomNumber} is free.`);
    if (r !== undefined) o.onOpenChange(false);
  }
  return (
    <Shell
      {...o}
      title={`Cancel ${booking.ref}?`}
      description={`Room ${booking.roomNumber} becomes free for ${dates(booking)}.${booking.hasEmail && notify ? ` ${booking.guest} will get a cancellation email.` : ""}`}
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <FormField label="Reason">
          {(p) => <Textarea {...p} value={reason} onChange={(e) => setReason(e.target.value)} rows={2} required placeholder="e.g. Guest called to cancel" />}
        </FormField>
        {booking.hasEmail ? <Checkbox label="Email the guest" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> : null}
        <Actions>
          <Btn onClick={() => o.onOpenChange(false)}>Keep booking</Btn>
          <Btn type="submit" variant="danger" disabled={pending || !reason.trim()}>
            Cancel booking
          </Btn>
        </Actions>
      </form>
    </Shell>
  );
}

export function NoShowDialog({ booking, ...o }: Open & { booking: BookingSummary }) {
  const mark = useMutation(api.admin.reservations.markNoShow);
  const { run, pending } = useRun();
  const [notify, setNotify] = useState(false);
  return (
    <Shell {...o} title={`Mark ${booking.guest} as a no-show?`} description={`${booking.ref}. Room ${booking.roomNumber} is released for ${dates(booking)}.`}>
      {booking.hasEmail ? <Checkbox label="Email the guest that the booking is cancelled" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> : null}
      <Actions>
        <Btn onClick={() => o.onOpenChange(false)}>Back</Btn>
        <Btn
          variant="danger"
          disabled={pending}
          onClick={async () => {
            const r = await run(() => mark({ id: booking.id, notifyGuest: notify }), `${booking.ref} marked as a no-show`);
            if (r !== undefined) o.onOpenChange(false);
          }}
        >
          Mark no-show
        </Btn>
      </Actions>
    </Shell>
  );
}

// ─── Change dates / move room ────────────────────────────────────────────────

export function ChangeDatesDialog({ booking, checkedIn, ...o }: Open & { booking: BookingSummary & { roomTypeId: Id<"roomTypes">; roomId: Id<"rooms">; manualRate: boolean }; checkedIn: boolean }) {
  const change = useMutation(api.admin.reservations.changeDates);
  const { run, pending } = useRun();
  const [checkIn, setCheckIn] = useState(booking.checkIn);
  const [checkOut, setCheckOut] = useState(booking.checkOut);
  const [roomId, setRoomId] = useState<string>(booking.roomId);
  const [reprice, setReprice] = useState(false);
  const [notify, setNotify] = useState(true);
  const valid = checkOut > checkIn;
  const avail = useQuery(api.admin.reservations.availableForStay, o.open && valid ? { checkIn, checkOut, ignoreBookingId: booking.id } : "skip");
  const options = avail?.ok ? avail.results : [];
  const current = options.find((t) => t.roomTypeId === booking.roomTypeId);
  const roomFree = options.some((t) => t.freeRooms.some((r) => r.id === roomId));
  const nights = valid ? nightsBetween(checkIn, checkOut) : 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const r = await run(
      () => change({ id: booking.id, checkIn, checkOut, roomId: roomId as Id<"rooms">, reprice, notifyGuest: notify }),
      (r) => `${booking.ref}: ${formatDateShort(checkIn)} – ${formatDateShort(checkOut)}, room ${r.roomNumber}, ${naira(r.amountDue)}`,
    );
    if (r) o.onOpenChange(false);
  }

  return (
    <Shell {...o} title={`Change dates · ${booking.ref}`} description={`${booking.guest}, now ${dates(booking)} in room ${booking.roomNumber}.`}>
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Check in">{(p) => <DateField {...p} value={checkIn} onChange={setCheckIn} disabled={checkedIn} />}</FormField>
          <FormField label="Check out">{(p) => <DateField {...p} value={checkOut} min={addDays(checkIn, 1)} onChange={setCheckOut} />}</FormField>
        </div>
        {avail && !avail.ok ? <p className="m-0 text-sm text-bad">{avail.message}</p> : null}
        <FormField label="Room" hint={nights ? plural(nights, "night") : undefined} error={avail?.ok && !roomFree ? "This room isn't free for the new dates. Pick another." : null}>
          {(p) => (
            <Choice
              {...p}
              value={roomId}
              onChange={setRoomId}
              options={[
                { value: booking.roomId, label: `${booking.roomType} ${booking.roomNumber} (current)` },
                ...options.flatMap((t) => t.freeRooms.filter((r) => r.id !== booking.roomId).map((r) => ({ value: r.id, label: `${t.name} ${r.number}` }))),
              ]}
            />
          )}
        </FormField>
        {booking.manualRate ? (
          <Checkbox label="Re-price at today's rates (otherwise keep the special rate)" checked={reprice} onChange={(e) => setReprice(e.target.checked)} />
        ) : current ? (
          <p className="m-0 text-sm text-body">
            New total at current rates: <strong className="tabular-nums">{naira(current.total)}</strong>
          </p>
        ) : null}
        {booking.hasEmail ? <Checkbox label="Email the guest the new details" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> : null}
        <Actions>
          <Btn onClick={() => o.onOpenChange(false)}>Cancel</Btn>
          <Btn type="submit" variant="primary" disabled={pending || !valid || (avail?.ok && !roomFree)}>
            Save new dates
          </Btn>
        </Actions>
      </form>
    </Shell>
  );
}

export function MoveRoomDialog({ booking, ...o }: Open & { booking: BookingSummary & { roomId: Id<"rooms">; status: string } }) {
  const move = useMutation(api.admin.reservations.moveRoom);
  const { run, pending } = useRun();
  const today = todayLagos();
  // A checked-in guest moves from tonight on.
  const from = booking.status === "checked_in" && booking.checkIn < today ? today : booking.checkIn;
  const avail = useQuery(api.admin.reservations.availableForStay, o.open && from < booking.checkOut ? { checkIn: from, checkOut: booking.checkOut, ignoreBookingId: booking.id } : "skip");
  const [roomId, setRoomId] = useState("");
  const rooms = avail?.ok ? avail.results.flatMap((t) => t.freeRooms.filter((r) => r.id !== booking.roomId).map((r) => ({ ...r, type: t.name }))) : [];
  return (
    <Shell {...o} title={`Move ${booking.guest}`} description={`${booking.ref}, now in room ${booking.roomNumber}. Free rooms for ${formatDateShort(from)} – ${formatDateShort(booking.checkOut)}; the price stays the same.`}>
      <FormField label="New room">
        {(p) => (
          <Choice
            {...p}
            value={roomId}
            onChange={setRoomId}
            disabled={!rooms.length}
            placeholder={avail === undefined ? "Loading…" : rooms.length ? "Choose a room" : "No other room is free for these nights"}
            options={rooms.map((r) => ({ value: r.id, label: `${r.type} ${r.number}` }))}
          />
        )}
      </FormField>
      <Actions>
        <Btn onClick={() => o.onOpenChange(false)}>Cancel</Btn>
        <Btn
          variant="primary"
          disabled={pending || !roomId}
          onClick={async () => {
            const r = await run(() => move({ id: booking.id, roomId: roomId as Id<"rooms"> }), (r) => `Booking moved to ${r.roomNumber}`);
            if (r) o.onOpenChange(false);
          }}
        >
          Move booking
        </Btn>
      </Actions>
    </Shell>
  );
}

// ─── Edit guest ──────────────────────────────────────────────────────────────

type GuestEdit = {
  id: Id<"bookings">;
  ref: string;
  guestDetails: { firstName: string; lastName: string; email: string; phone: string };
  adults: number;
  children: number;
  arrivalWindow: string | null;
  specialRequests: string | null;
  purpose: "business" | "leisure" | "event" | "other" | null;
};

export function EditGuestDialog({ booking, ...o }: Open & { booking: GuestEdit }) {
  const update = useMutation(api.admin.reservations.updateGuest);
  const [pending, setPending] = useState(false);
  const [g, setG] = useState(booking.guestDetails);
  const [adults, setAdults] = useState(String(booking.adults));
  const [children, setChildren] = useState(String(booking.children));
  const [arrival, setArrival] = useState(booking.arrivalWindow ?? "");
  const [requests, setRequests] = useState(booking.specialRequests ?? "");
  const [fieldErr, setFieldErr] = useState<{ field?: string; message: string } | null>(null);
  const err = (f: string) => (fieldErr?.field === f ? fieldErr.message : null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    try {
      await update({
        id: booking.id,
        guest: g,
        adults: Number(adults),
        children: Number(children),
        arrivalWindow: arrival || undefined,
        specialRequests: requests || undefined,
        purpose: booking.purpose ?? undefined,
      });
      o.onOpenChange(false);
      toast.success("Guest details saved");
    } catch (e) {
      setFieldErr({ field: errorField(e), message: errorText(e) });
    } finally {
      setPending(false);
    }
  }

  return (
    <Shell {...o} title={`Edit guest · ${booking.ref}`}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-4">
        <FormField label="First name" error={err("firstName")}>{(p) => <Input {...p} value={g.firstName} onChange={(e) => setG({ ...g, firstName: e.target.value })} />}</FormField>
        <FormField label="Last name" error={err("lastName")}>{(p) => <Input {...p} value={g.lastName} onChange={(e) => setG({ ...g, lastName: e.target.value })} />}</FormField>
        <FormField label="Phone" error={err("phone")} className="col-span-2">{(p) => <Input {...p} type="tel" value={g.phone} onChange={(e) => setG({ ...g, phone: e.target.value })} />}</FormField>
        <FormField label="Email" error={err("email")} className="col-span-2">{(p) => <Input {...p} type="email" value={g.email} onChange={(e) => setG({ ...g, email: e.target.value })} />}</FormField>
        <FormField label="Adults" error={err("adults")}>{(p) => <Input {...p} type="number" min={1} max={20} value={adults} onChange={(e) => setAdults(e.target.value)} />}</FormField>
        <FormField label="Children" error={err("children")}>{(p) => <Input {...p} type="number" min={0} max={20} value={children} onChange={(e) => setChildren(e.target.value)} />}</FormField>
        <FormField label="Expected arrival" className="col-span-2">{(p) => <Input {...p} value={arrival} onChange={(e) => setArrival(e.target.value)} maxLength={40} placeholder="e.g. 16:00–18:00" />}</FormField>
        <FormField label="Special requests" error={err("specialRequests")} className="col-span-2">{(p) => <Textarea {...p} value={requests} onChange={(e) => setRequests(e.target.value)} rows={3} maxLength={500} />}</FormField>
        {fieldErr && !fieldErr.field ? <p className="col-span-2 m-0 text-sm text-bad">{fieldErr.message}</p> : null}
        <Actions>
          <Btn onClick={() => o.onOpenChange(false)}>Cancel</Btn>
          <Btn type="submit" variant="primary" disabled={pending}>
            Save
          </Btn>
        </Actions>
      </form>
    </Shell>
  );
}

// ─── New booking (phone, WhatsApp, walk-in) ─────────────────────────────────

export type NewBookingPrefill = {
  checkIn?: string;
  checkOut?: string;
  roomTypeId?: Id<"roomTypes">;
  roomId?: Id<"rooms">;
  guest?: { firstName?: string; lastName?: string; email?: string; phone?: string };
  specialRequests?: string;
  source?: (typeof SOURCES)[number]["value"];
};

/** The form mounts on each open, so it always starts from the latest prefill. */
export function NewBookingDialog({ prefill, ...o }: Open & { prefill?: NewBookingPrefill }) {
  return (
    <Shell {...o} wide title="New booking" description="For phone, WhatsApp and walk-in guests. The room is held the moment you create it.">
      {o.open ? <NewBookingForm prefill={prefill} onDone={() => o.onOpenChange(false)} /> : null}
    </Shell>
  );
}

function NewBookingForm({ prefill, onDone }: { prefill?: NewBookingPrefill; onDone: () => void }) {
  const o = { onOpenChange: (open: boolean) => !open && onDone() };
  const create = useAction(api.admin.reservations.create);
  const router = useRouter();
  const today = todayLagos();
  const [checkIn, setCheckIn] = useState(prefill?.checkIn ?? today);
  const [checkOut, setCheckOut] = useState(prefill?.checkOut ?? addDays(prefill?.checkIn ?? today, 1));
  const [adults, setAdults] = useState("1");
  const [children, setChildren] = useState("0");
  const [typeId, setTypeId] = useState<string>(prefill?.roomTypeId ?? "");
  const [roomId, setRoomId] = useState<string>(prefill?.roomId ?? "");
  const [guest, setGuest] = useState({ firstName: "", lastName: "", email: "", phone: "", ...prefill?.guest });
  const [source, setSource] = useState<string>(prefill?.source ?? "phone");
  const [arrival, setArrival] = useState("");
  const [requests, setRequests] = useState(prefill?.specialRequests ?? "");
  const [special, setSpecial] = useState(false);
  const [rate, setRate] = useState("");
  const [rateReason, setRateReason] = useState("");
  const [checkInNow, setCheckInNow] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [pending, setPending] = useState(false);
  const [fieldErr, setFieldErr] = useState<{ field?: string; message: string } | null>(null);

  const valid = checkOut > checkIn;
  const avail = useQuery(api.admin.reservations.availableForStay, valid ? { checkIn, checkOut } : "skip");
  const types = useMemo(() => (avail?.ok ? avail.results : []), [avail]);
  const type = types.find((t) => t.roomTypeId === typeId);
  const nights = valid ? nightsBetween(checkIn, checkOut) : 0;
  const rateKobo = special ? toKobo(rate) : null;
  const total = special ? (rateKobo ?? 0) * nights : (type?.total ?? 0);
  const err = (f: string) => (fieldErr?.field === f ? fieldErr.message : null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFieldErr(null);
    if (!type) return setFieldErr({ field: "roomTypeId", message: "Choose a room type." });
    if (special && !rateKobo) return setFieldErr({ field: "nightlyRate", message: "Enter the special nightly rate." });
    setPending(true);
    try {
      const r = await create({
        roomTypeId: type.roomTypeId,
        roomId: (roomId || undefined) as Id<"rooms"> | undefined,
        checkIn,
        checkOut,
        adults: Number(adults),
        children: Number(children),
        guest: { ...guest, email: guest.email || undefined },
        source: source as Exclude<(typeof SOURCES)[number]["value"], "website">,
        arrivalWindow: arrival || undefined,
        specialRequests: requests || undefined,
        rateOverride: special && rateKobo ? { nightlyRate: rateKobo, reason: rateReason } : undefined,
        checkInNow: checkInNow && checkIn <= today,
        sendConfirmation: sendEmail,
      });
      o.onOpenChange(false);
      toast.success(`Booked ${r.ref}`);
      router.push(`/admin/reservations/${r.id}`);
    } catch (e) {
      setFieldErr({ field: errorField(e), message: errorText(e) });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="mb-2 text-sm font-semibold">1. Dates</legend>
          <FormField label="Check in" error={err("checkIn")}>{(p) => <DateField {...p} value={checkIn} min={addDays(today, -1)} onChange={(d) => { setCheckIn(d); if (checkOut <= d) setCheckOut(addDays(d, 1)); }} />}</FormField>
          <FormField label="Check out" error={err("checkOut")}>{(p) => <DateField {...p} value={checkOut} min={addDays(checkIn, 1)} onChange={setCheckOut} />}</FormField>
          <FormField label="Adults" error={err("adults")}>{(p) => <Input {...p} type="number" min={1} max={20} value={adults} onChange={(e) => setAdults(e.target.value)} />}</FormField>
          <FormField label="Children" error={err("children")}>{(p) => <Input {...p} type="number" min={0} max={20} value={children} onChange={(e) => setChildren(e.target.value)} />}</FormField>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-semibold">2. Room {nights ? <span className="font-normal text-muted">· {plural(nights, "night")}</span> : null}</legend>
          {avail && !avail.ok ? <p className="m-0 text-sm text-bad">{avail.message}</p> : null}
          {avail === undefined && valid ? <p className="m-0 text-sm text-muted">Checking availability…</p> : null}
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Room type">
            {types.map((t) => {
              const free = t.freeRooms.length;
              const on = t.roomTypeId === typeId;
              return (
                <label
                  key={t.roomTypeId}
                  className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm ${on ? "border-amber bg-[#FBF5EF]" : "border-line"} ${free ? "" : "cursor-not-allowed opacity-50"}`}
                >
                  <input type="radio" name="type" className="accent-amber" checked={on} disabled={!free} onChange={() => { setTypeId(t.roomTypeId); setRoomId(""); }} />
                  <span className="min-w-0 flex-1">
                    <strong>{t.name}</strong>
                    {!t.published ? <span className="text-muted"> (hidden on website)</span> : null}
                    <span className="block text-xs text-muted">{free ? `${free} free` : "Full"} · up to {t.maxAdults} adults</span>
                  </span>
                  <span className="tabular-nums">{naira(t.total)}</span>
                </label>
              );
            })}
          </div>
          {err("roomTypeId") ? <p className="m-0 text-sm text-bad">{err("roomTypeId")}</p> : null}
          {type ? (
            <FormField label="Room" hint="Leave on automatic to take the first free room." error={err("roomId")}>
              {(p) => (
                <Choice {...p} value={roomId} onChange={setRoomId} options={[{ value: "", label: "Automatic" }, ...type.freeRooms.map((r) => ({ value: r.id, label: `Room ${r.number}` }))]} />
              )}
            </FormField>
          ) : null}
        </fieldset>

        <fieldset className="grid grid-cols-2 gap-3">
          <legend className="mb-2 text-sm font-semibold">3. Guest</legend>
          <FormField label="First name" error={err("firstName")}>{(p) => <Input {...p} autoComplete="off" value={guest.firstName} onChange={(e) => setGuest({ ...guest, firstName: e.target.value })} required />}</FormField>
          <FormField label="Last name" error={err("lastName")}>{(p) => <Input {...p} autoComplete="off" value={guest.lastName} onChange={(e) => setGuest({ ...guest, lastName: e.target.value })} required />}</FormField>
          <FormField label="Phone" error={err("phone")}>{(p) => <Input {...p} type="tel" autoComplete="off" value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} required placeholder="0803 123 4567" />}</FormField>
          <FormField label="Email (optional)" error={err("email")}>{(p) => <Input {...p} type="email" autoComplete="off" value={guest.email} onChange={(e) => setGuest({ ...guest, email: e.target.value })} />}</FormField>
          <FormField label="Booked by">
            {(p) => (
              <Choice {...p} value={source} onChange={setSource} options={SOURCES.filter((s) => s.value !== "website").map((s) => ({ ...s }))} />
            )}
          </FormField>
          <FormField label="Expected arrival">{(p) => <Input {...p} value={arrival} onChange={(e) => setArrival(e.target.value)} maxLength={40} placeholder="e.g. 18:00" />}</FormField>
          <FormField label="Special requests" className="col-span-2" error={err("specialRequests")}>{(p) => <Textarea {...p} rows={2} value={requests} onChange={(e) => setRequests(e.target.value)} maxLength={500} />}</FormField>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-semibold">4. Price</legend>
          <Checkbox label="Use a special rate" checked={special} onChange={(e) => setSpecial(e.target.checked)} />
          {special ? (
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Nightly rate (₦)" error={err("nightlyRate")}>{(p) => <Input {...p} inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />}</FormField>
              <FormField label="Reason" error={err("rateReason")}>{(p) => <Input {...p} value={rateReason} onChange={(e) => setRateReason(e.target.value)} required placeholder="e.g. Corporate rate, manager approved" />}</FormField>
            </div>
          ) : null}
          {checkIn <= today ? <Checkbox label="Guest is here now: check them in" checked={checkInNow} onChange={(e) => setCheckInNow(e.target.checked)} /> : null}
          {guest.email ? <Checkbox label="Email the guest a confirmation" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} /> : null}
        </fieldset>

        {fieldErr && !["checkIn", "checkOut", "adults", "children", "roomTypeId", "roomId", "firstName", "lastName", "phone", "email", "nightlyRate", "rateReason", "specialRequests"].includes(fieldErr.field ?? "") ? (
          <p role="alert" className="m-0 rounded-md bg-bad-bg px-3 py-2 text-sm text-bad">{fieldErr.message}</p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <p className="m-0 text-sm">
            Total {nights ? `for ${plural(nights, "night")}` : ""}: <strong className="text-lg tabular-nums">{type || special ? naira(total) : "–"}</strong>
            <span className="block text-xs text-muted">Paid at the hotel</span>
          </p>
          <div className="flex gap-2">
            <Btn onClick={() => o.onOpenChange(false)}>Cancel</Btn>
            <Btn type="submit" variant="primary" disabled={pending || !valid}>
              {pending ? "Booking…" : "Create booking"}
            </Btn>
          </div>
        </div>
      </form>
    </>
  );
}
