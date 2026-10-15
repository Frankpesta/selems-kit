"use client";

import { Fragment, useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { cn } from "cn";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { addDays, nightsBetween, todayLagos, weekday } from "@/lib/dates";
import { formatDateShort, plural } from "@/lib/format";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Btn, FormField, Input, Loading, Pane, PageHeader, Panel } from "../ui";
import { Choice, DateField } from "../pickers";
import { useRun } from "../lib";
import { ReservationDetail } from "../reservations/ReservationDetail";
import { NewBookingDialog, type NewBookingPrefill } from "../reservations/dialogs";

// Availability (docs/06): rooms × 14 nights. Drag a booking to another room to
// move it; drag across empty nights to book or block them. Every action is
// also reachable from the booking panel and the "Block dates" button.

const DAYS = 14;
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const REASONS = [
  { value: "maintenance", label: "Maintenance" },
  { value: "event", label: "Event" },
  { value: "owner_use", label: "Owner use" },
  { value: "other", label: "Other" },
] as const;

type Grid = NonNullable<ReturnType<typeof useQuery<typeof api.admin.availability.grid>>>;
type Row = Grid["rows"][number];
type Seg = Row["segments"][number];
type Selection = { roomId: Id<"rooms">; from: number; to: number };

const segClass = (s: Seg) => {
  if (s.kind === "block") return "bg-[repeating-linear-gradient(45deg,#E2E6E8_0_6px,#F1F3F4_6px_12px)] text-[#4A5964]";
  if (s.attention) return "bg-[#F2C894] text-[#5B3005]";
  if (s.status === "checked_in") return "bg-ok text-white";
  if (s.status === "checked_out") return "bg-[#C9D0D2] text-ink";
  return "bg-info text-white";
};

export function AvailabilityGrid() {
  const [from, setFrom] = useState(() => todayLagos());
  const data = useQuery(api.admin.availability.grid, { from, days: DAYS });
  const move = useMutation(api.admin.reservations.moveRoom);
  const { run } = useRun();
  const [openBooking, setOpenBooking] = useState<Id<"bookings"> | null>(null);
  const [openBlock, setOpenBlock] = useState<Extract<Seg, { kind: "block" }> | null>(null);
  const [blockDialog, setBlockDialog] = useState<{ roomId?: Id<"rooms">; start?: string; end?: string } | null>(null);
  const [newBooking, setNewBooking] = useState<NewBookingPrefill | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [menu, setMenu] = useState<Selection | null>(null);
  const [dragging, setDragging] = useState<Id<"bookings"> | null>(null);
  const [dropRow, setDropRow] = useState<Id<"rooms"> | null>(null);

  useEffect(() => {
    if (!selecting) return;
    const up = () => {
      setSelecting(false);
      setSelection((s) => {
        if (s) setMenu(s);
        return null;
      });
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, [selecting]);

  const end = addDays(from, DAYS - 1);
  const rowsByType = data ? groupBy(data.rows) : [];
  const roomOf = (id: Id<"rooms">) => data?.rows.find((r) => r.id === id);

  async function drop(row: Row) {
    setDropRow(null);
    if (!dragging) return;
    const id = dragging;
    setDragging(null);
    // The server re-checks the target room; on conflict nothing moves and the toast explains why.
    await run(() => move({ id, roomId: row.id }), (r) => `Booking moved to ${r.roomNumber}`);
  }

  const selRange = (s: Selection) => {
    const a = Math.min(s.from, s.to);
    const b = Math.max(s.from, s.to);
    return { start: addDays(from, a), end: addDays(from, b + 1), nights: b - a + 1 };
  };

  return (
    <>
      <PageHeader
        title="Availability"
        subtitle={`${formatDateShort(from)} – ${formatDateShort(end)} · drag a booking to move it, drag across empty nights to book or block`}
        actions={
          <>
            <Btn aria-label="Previous two weeks" onClick={() => setFrom(addDays(from, -DAYS))}>
              <ChevronLeftIcon aria-hidden />
            </Btn>
            <Btn onClick={() => setFrom(todayLagos())}>Today</Btn>
            <Btn aria-label="Next two weeks" onClick={() => setFrom(addDays(from, DAYS))}>
              <ChevronRightIcon aria-hidden />
            </Btn>
            <label className="sr-only" htmlFor="grid-jump">
              Jump to date
            </label>
            <DateField id="grid-jump" className="w-48" value={from} onChange={(d) => d && setFrom(d)} />
            <Btn variant="dark" onClick={() => setBlockDialog({})}>
              Block dates
            </Btn>
          </>
        }
      />
      <Pane>
        <ul className="m-0 flex list-none flex-wrap items-center gap-4 p-0 text-[13px]" aria-label="Key">
          {[
            ["bg-info", "Reserved"],
            ["bg-ok", "Checked in"],
            ["bg-[#F2C894]", "Late / needs attention"],
            ["bg-[repeating-linear-gradient(45deg,#E2E6E8_0_6px,#F1F3F4_6px_12px)] border border-line", "Blocked"],
          ].map(([c, l]) => (
            <li key={l} className="inline-flex items-center gap-1.5">
              <i className={cn("inline-block size-3.5 rounded-sm", c)} aria-hidden />
              {l}
            </li>
          ))}
        </ul>
        <Panel className="overflow-x-auto">
          {data === undefined ? (
            <Loading />
          ) : (
            <div className="min-w-[1000px] select-none" role="grid" aria-label={`Rooms and nights from ${formatDateShort(from)}`}>
              <div role="row" className="grid grid-cols-[170px_repeat(14,minmax(0,1fr))] border-b border-line bg-[#F7F8F7]">
                <span role="columnheader" className="border-r border-line px-3.5 py-2.5 text-[13px] font-semibold">
                  Room
                </span>
                {data.dates.map((d) => (
                  <span
                    role="columnheader"
                    key={d.date}
                    className={cn("py-2 text-center text-xs leading-tight text-muted tabular-nums", d.weekend && "bg-[#FAF6F1]", d.today && "bg-[#EEF3F7] font-semibold text-ink")}
                  >
                    {DAY_NAMES[weekday(d.date)]}
                    <span className="block text-[13px] text-ink">{Number(d.date.slice(8))}</span>
                  </span>
                ))}
              </div>
              {rowsByType.map(([typeName, rows]) => (
                <Fragment key={typeName}>
                  <div role="row" className="border-b border-line bg-stone px-3.5 py-1.5 text-xs font-semibold tracking-wide text-muted uppercase">
                    <span role="rowheader">{typeName}</span>
                  </div>
                  {rows.map((row) => (
                    <div
                      key={row.id}
                      role="row"
                      className={cn("grid min-h-[52px] grid-cols-[170px_repeat(14,minmax(0,1fr))] border-b border-[#EEF0F0]", dropRow === row.id && "bg-[#FBF5EF]")}
                      onDragOver={(e) => {
                        if (!dragging) return;
                        e.preventDefault();
                        setDropRow(row.id);
                      }}
                      onDragLeave={() => setDropRow((r) => (r === row.id ? null : r))}
                      onDrop={(e) => {
                        e.preventDefault();
                        void drop(row);
                      }}
                    >
                      <span role="rowheader" className="col-start-1 row-start-1 flex flex-col justify-center border-r border-line px-3.5 py-1.5 text-[13px]">
                        <strong>{row.number}</strong>
                        {row.status === "out_of_service" ? <span className="text-bad">Out of service</span> : <span className="truncate text-muted">{row.typeName}</span>}
                      </span>
                      {data.dates.map((d, i) => {
                        const inSel = selection?.roomId === row.id && i >= Math.min(selection.from, selection.to) && i <= Math.max(selection.from, selection.to);
                        return (
                          <span
                            key={d.date}
                            role="gridcell"
                            aria-label={`Room ${row.number}, night of ${formatDateShort(d.date)}`}
                            style={{ gridColumn: i + 2, gridRow: 1 }}
                            className={cn(
                              "border-r border-[#F1F3F3]",
                              d.weekend && "bg-[#FAF6F1]",
                              d.today && "bg-[#EEF3F7]",
                              row.status === "out_of_service" && "bg-[#F4F5F5]",
                              inSel && "bg-amber-soft",
                              row.status === "active" && "cursor-cell",
                            )}
                            onPointerDown={(e) => {
                              if (row.status !== "active" || e.button !== 0) return;
                              setSelecting(true);
                              setSelection({ roomId: row.id, from: i, to: i });
                            }}
                            onPointerEnter={() => {
                              if (selecting) setSelection((s) => (s && s.roomId === row.id ? { ...s, to: i } : s));
                            }}
                          />
                        );
                      })}
                      {row.segments.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          draggable={s.kind === "booking" && (s.status === "reserved" || s.status === "checked_in")}
                          onDragStart={(e) => {
                            if (s.kind !== "booking") return;
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", s.id);
                            setDragging(s.id);
                          }}
                          onDragEnd={() => {
                            setDragging(null);
                            setDropRow(null);
                          }}
                          onClick={() => (s.kind === "booking" ? setOpenBooking(s.id) : setOpenBlock(s))}
                          style={{ gridColumn: `${s.start + 2} / span ${s.span}`, gridRow: 1 }}
                          className={cn(
                            "z-[1] mx-[3px] my-2 flex min-h-9 items-center overflow-hidden rounded px-2 text-left text-xs font-semibold whitespace-nowrap text-ellipsis",
                            segClass(s),
                            s.startsBefore && "ml-0 rounded-l-none",
                            s.endsAfter && "mr-0 rounded-r-none",
                            s.kind === "booking" && "cursor-grab active:cursor-grabbing",
                          )}
                          aria-label={
                            s.kind === "booking"
                              ? `${s.guest}, ${s.ref}, ${formatDateShort(s.checkIn)} to ${formatDateShort(s.checkOut)}, room ${row.number}. Open booking.`
                              : `Room ${row.number} blocked (${REASONS.find((r) => r.value === s.reason)?.label}). Open block.`
                          }
                        >
                          <span className="truncate">{s.kind === "booking" ? s.guest : (REASONS.find((r) => r.value === s.reason)?.label ?? "Blocked")}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </Fragment>
              ))}
              <div role="row" className="grid grid-cols-[170px_repeat(14,minmax(0,1fr))] bg-[#F7F8F7] text-[11px] tabular-nums">
                <span role="rowheader" className="border-r border-line px-3.5 py-2 text-[13px] font-semibold">
                  Free
                </span>
                {data.free.map((f, i) => (
                  <span role="gridcell" key={data.dates[i].date} className="py-1.5 text-center leading-tight text-muted">
                    <span className="block">Suites {f.suites}</span>
                    <span className="block">Rooms {f.rooms}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </Panel>
        {data && data.rows.length === 0 ? <p className="m-0 text-sm text-muted">No rooms yet. Add them in Rooms &amp; rates → Room units.</p> : null}
      </Pane>

      {/* Drag-select menu */}
      <Dialog open={!!menu} onOpenChange={(o) => !o && setMenu(null)}>
        <DialogContent className="sm:max-w-sm">
          {menu ? (
            <>
              <DialogHeader>
                <DialogTitle>Room {roomOf(menu.roomId)?.number}</DialogTitle>
                <DialogDescription>
                  {formatDateShort(selRange(menu).start)} – {formatDateShort(selRange(menu).end)}, {plural(selRange(menu).nights, "night")}
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-2">
                <Btn
                  variant="primary"
                  onClick={() => {
                    const r = roomOf(menu.roomId);
                    const { start, end } = selRange(menu);
                    setNewBooking({ checkIn: start, checkOut: end, roomTypeId: r?.roomTypeId, roomId: menu.roomId });
                    setMenu(null);
                  }}
                >
                  New booking for room {roomOf(menu.roomId)?.number}, {plural(selRange(menu).nights, "night")}
                </Btn>
                <Btn
                  onClick={() => {
                    const { start, end } = selRange(menu);
                    setBlockDialog({ roomId: menu.roomId, start, end });
                    setMenu(null);
                  }}
                >
                  Block room
                </Btn>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Sheet open={!!openBooking} onOpenChange={(o) => !o && setOpenBooking(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-white p-5 sm:max-w-md">
          <SheetTitle className="sr-only">Booking details</SheetTitle>
          {openBooking ? <ReservationDetail id={openBooking} compact /> : null}
        </SheetContent>
      </Sheet>

      {openBlock ? <BlockDetails block={openBlock} onClose={() => setOpenBlock(null)} rows={data?.rows ?? []} /> : null}
      {blockDialog ? <BlockDialog init={blockDialog} rows={data?.rows ?? []} onClose={() => setBlockDialog(null)} /> : null}
      <NewBookingDialog open={!!newBooking} onOpenChange={(o) => !o && setNewBooking(null)} prefill={newBooking ?? undefined} />
    </>
  );
}

function groupBy(rows: Row[]): [string, Row[]][] {
  const out: [string, Row[]][] = [];
  for (const r of rows) {
    const last = out.at(-1);
    if (last && last[0] === r.typeName) last[1].push(r);
    else out.push([r.typeName, [r]]);
  }
  return out;
}

function BlockDetails({ block, rows, onClose }: { block: Extract<Seg, { kind: "block" }>; rows: Row[]; onClose: () => void }) {
  const remove = useMutation(api.admin.availability.removeBlock);
  const { run, pending } = useRun();
  const room = rows.find((r) => r.segments.some((s) => s.id === block.id));
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Room {room?.number} blocked</DialogTitle>
          <DialogDescription>
            {REASONS.find((r) => r.value === block.reason)?.label}: {formatDateShort(block.startDate)} – {formatDateShort(block.endDate)} (
            {plural(nightsBetween(block.startDate, block.endDate), "night")}).
            {block.note ? ` ${block.note}` : ""}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-end gap-2">
          <Btn onClick={onClose}>Close</Btn>
          <Btn
            variant="danger"
            disabled={pending}
            onClick={async () => {
              const r = await run(() => remove({ id: block.id }), `Room ${room?.number} unblocked`);
              if (r !== undefined) onClose();
            }}
          >
            Remove block
          </Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BlockDialog({ init, rows, onClose }: { init: { roomId?: Id<"rooms">; start?: string; end?: string }; rows: Row[]; onClose: () => void }) {
  const create = useMutation(api.admin.availability.createBlock);
  const { run, pending } = useRun();
  const today = todayLagos();
  const [roomId, setRoomId] = useState<string>(init.roomId ?? "");
  const [start, setStart] = useState(init.start ?? today);
  const [end, setEnd] = useState(init.end ?? addDays(init.start ?? today, 1));
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("maintenance");
  const [note, setNote] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    const room = rows.find((r) => r.id === roomId);
    const r = await run(() => create({ roomId: roomId as Id<"rooms">, startDate: start, endDate: end, reason, note: note || undefined }), `Room ${room?.number} blocked`);
    if (r) onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Block a room</DialogTitle>
          <DialogDescription>The room can&rsquo;t be booked online or by staff on these nights.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <FormField label="Room" className="col-span-2">
            {(p) => (
              <Choice
                {...p}
                value={roomId}
                onChange={setRoomId}
                placeholder="Choose a room"
                options={rows.filter((r) => r.status === "active").map((r) => ({ value: r.id, label: `${r.number} · ${r.typeName}` }))}
              />
            )}
          </FormField>
          <FormField label="First night">{(p) => <DateField {...p} min={today} value={start} onChange={(d) => { setStart(d); if (end <= d) setEnd(addDays(d, 1)); }} />}</FormField>
          <FormField label="Available again on">{(p) => <DateField {...p} min={addDays(start, 1)} value={end} onChange={setEnd} />}</FormField>
          <FormField label="Reason">
            {(p) => (
              <Choice {...p} value={reason} onChange={(v) => setReason(v as typeof reason)} options={[...REASONS]} />
            )}
          </FormField>
          <FormField label="Note (optional)">{(p) => <Input {...p} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />}</FormField>
          <DialogFooter className="col-span-2 mt-2 flex-row justify-end gap-2">
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn type="submit" variant="dark" disabled={pending || !roomId || end <= start}>
              Block {end > start ? plural(nightsBetween(start, end), "night") : ""}
            </Btn>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
