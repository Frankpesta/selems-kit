"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useConvex, useQuery } from "convex/react";
import { DownloadIcon, PlusIcon } from "lucide-react";
import { cn } from "cn";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { formatDateShort } from "@/lib/format";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Btn, Empty, Input, Loading, Pane, PageHeader, Panel, Pill, tdClass, thClass } from "../ui";
import { Choice, DateField } from "../pickers";
import { PAYMENT, SOURCES, STATUS, downloadCsv, naira, sourceLabel, useRun } from "../lib";
import { ReservationDetail } from "./ReservationDetail";
import { NewBookingDialog, type NewBookingPrefill } from "./dialogs";

// Reservations (docs/06): tabs, URL-synced filters, table, details panel.

const TABS = [
  { key: "all", label: "All" },
  { key: "attention", label: "Needs attention" },
  { key: "arriving", label: "Arriving (7 days)" },
  { key: "in_house", label: "In house" },
  { key: "checked_out", label: "Checked out" },
  { key: "cancelled", label: "Cancelled / no-show" },
] as const;
type Tab = (typeof TABS)[number]["key"];

function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

export function ReservationsView() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tab = (TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "all") as Tab;
  const [search, setSearch] = useState(params.get("q") ?? "");
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const type = params.get("type") ?? "";
  const source = params.get("source") ?? "";
  const selected = params.get("id") as Id<"bookings"> | null;
  const wide = useWide();
  // "Create booking from this" on an inquiry lands here with ?new=1&… prefilled.
  const [newOpen, setNewOpen] = useState(() => params.get("new") === "1");
  const [prefill, setPrefill] = useState<NewBookingPrefill | undefined>(() => {
    if (params.get("new") !== "1") return undefined;
    const [firstName, ...rest] = (params.get("name") ?? "").split(" ");
    return {
      guest: { firstName, lastName: rest.join(" "), email: params.get("email") ?? "", phone: params.get("phone") ?? "" },
      specialRequests: params.get("note") ?? undefined,
      source: "email",
    };
  });

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  // Debounced search → URL.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((params.get("q") ?? "") !== search) set({ q: search || null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Drop the prefill parameters from the URL once read.
  useEffect(() => {
    if (params.get("new") !== "1") return;
    set({ new: null, name: null, email: null, phone: null, note: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filters = {
    tab,
    search: params.get("q") || undefined,
    from: from || undefined,
    to: to || undefined,
    roomTypeId: (type || undefined) as Id<"roomTypes"> | undefined,
    source: (source || undefined) as (typeof SOURCES)[number]["value"] | undefined,
  };
  const rows = useQuery(api.admin.reservations.list, filters);
  const types = useQuery(api.admin.rooms.listTypes, {});
  const convex = useConvex();
  const { run, pending } = useRun();

  async function exportCsv() {
    await run(async () => {
      const data = await convex.query(api.admin.reservations.exportRows, filters);
      downloadCsv(
        `reservations-${tab}-${new Date().toISOString().slice(0, 10)}.csv`,
        ["Ref", "Guest", "Phone", "Email", "Room type", "Room", "Check in", "Check out", "Nights", "Adults", "Children", "Source", "Status", "Total (₦)", "Paid (₦)", "Balance (₦)"],
        data.map((r) => [r.ref, r.guest, r.phone, r.email, r.roomType, r.roomNumber, r.checkIn, r.checkOut, r.nights, r.adults, r.children, sourceLabel(r.source), STATUS[r.status].label, r.amountDue / 100, r.amountPaid / 100, r.balance / 100]),
      );
      return data.length;
    }, (n) => `Exported ${n} booking${n === 1 ? "" : "s"}`);
  }

  const detail = selected ? <ReservationDetail id={selected} compact /> : null;

  return (
    <>
      <PageHeader
        title="Reservations"
        subtitle="Click a booking to see and change it."
        actions={
          <>
            <Btn onClick={exportCsv} disabled={pending}>
              <DownloadIcon aria-hidden /> Export CSV
            </Btn>
            <Btn variant="primary" onClick={() => { setPrefill(undefined); setNewOpen(true); }}>
              <PlusIcon aria-hidden /> New booking
            </Btn>
          </>
        }
      />
      <Pane>
        <div role="tablist" aria-label="Reservation lists" className="flex flex-wrap gap-1 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => set({ tab: t.key === "all" ? null : t.key, id: null })}
              className={cn(
                "-mb-px min-h-11 border-b-2 border-transparent px-3.5 text-sm font-semibold text-muted hover:text-ink",
                tab === t.key && "border-amber text-ink",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2.5">
          <label className="sr-only" htmlFor="res-q">
            Search
          </label>
          <Input id="res-q" type="search" className="flex-[1_1_240px]" placeholder="Search name, phone or ref" value={search} onChange={(e) => setSearch(e.target.value)} />
          <DateField aria-label="Check-in from" placeholder="Check-in from" clearable className="w-52" value={from} onChange={(d) => set({ from: d || null })} />
          <DateField aria-label="Check-in to" placeholder="to" clearable className="w-52" min={from || undefined} value={to} onChange={(d) => set({ to: d || null })} />
          <Choice
            aria-label="Room type"
            className="w-48"
            value={type}
            onChange={(v) => set({ type: v || null })}
            options={[{ value: "", label: "All room types" }, ...(types ?? []).map((t) => ({ value: t.id, label: t.name }))]}
          />
          <Choice
            aria-label="Source"
            className="w-40"
            value={source}
            onChange={(v) => set({ source: v || null })}
            options={[{ value: "", label: "All sources" }, ...SOURCES.map((s) => ({ ...s }))]}
          />
        </div>

        <div className={cn("grid items-start gap-6", wide && selected && "grid-cols-[minmax(0,1fr)_400px]")}>
          <Panel>
            {rows === undefined ? (
              <Loading />
            ) : rows.length === 0 ? (
              <Empty>No bookings match.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm tabular-nums">
                  <thead>
                    <tr className="border-b border-line">
                      <th className={thClass}>Ref</th>
                      <th className={thClass}>Guest</th>
                      <th className={thClass}>Room</th>
                      <th className={thClass}>Dates</th>
                      <th className={thClass}>Nights</th>
                      <th className={thClass}>Source</th>
                      <th className={`${thClass} text-right`}>Total</th>
                      <th className={thClass}>Paid</th>
                      <th className={thClass}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.id}
                        onClick={() => set({ id: r.id })}
                        className={cn("cursor-pointer border-b border-[#EEF0F0] last:border-0 hover:bg-[#F7F8F7]", selected === r.id && "bg-selected hover:bg-selected")}
                      >
                        <td className={tdClass}>
                          <button type="button" className="min-h-11 text-left font-semibold whitespace-nowrap text-ink underline-offset-4 hover:underline" onClick={(e) => { e.stopPropagation(); set({ id: r.id }); }}>
                            {r.ref}
                          </button>
                        </td>
                        <td className={tdClass}>
                          <strong>{r.guest}</strong>
                          {r.attention ? <span className="block text-xs text-warn">{r.attention}</span> : null}
                        </td>
                        <td className={`${tdClass} whitespace-nowrap`}>
                          {r.roomType} <span className="text-muted">{r.roomNumber}</span>
                        </td>
                        <td className={`${tdClass} whitespace-nowrap`}>
                          {formatDateShort(r.checkIn)} – {formatDateShort(r.checkOut)}
                        </td>
                        <td className={tdClass}>{r.nights}</td>
                        <td className={tdClass}>{sourceLabel(r.source)}</td>
                        <td className={`${tdClass} text-right`}>{naira(r.amountDue)}</td>
                        <td className={tdClass}>
                          <Pill tone={PAYMENT[r.paymentStatus].tone}>{PAYMENT[r.paymentStatus].label}</Pill>
                        </td>
                        <td className={tdClass}>
                          <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
          {wide && selected ? (
            <Panel as="aside" aria-label="Booking details" bodyClassName="p-5" className="sticky top-4">
              {detail}
            </Panel>
          ) : null}
        </div>
      </Pane>
      {!wide ? (
        <Sheet open={!!selected} onOpenChange={(o) => !o && set({ id: null })}>
          <SheetContent side="right" className="w-full overflow-y-auto bg-white p-5 sm:max-w-md">
            <SheetTitle className="sr-only">Booking details</SheetTitle>
            {detail}
          </SheetContent>
        </Sheet>
      ) : null}
      <NewBookingDialog open={newOpen} onOpenChange={setNewOpen} prefill={prefill} />
    </>
  );
}
