"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { PhoneIcon, PlusIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { formatDate, formatDateShort, plural } from "@/lib/format";
import { Btn, Empty, Kpi, Loading, Pane, PageHeader, Panel, Pill, btnClass, tdClass, thClass } from "../ui";
import { PAYMENT, naira, timeAgo, useRun } from "../lib";
import { CheckOutDialog, NewBookingDialog, type BookingSummary } from "../reservations/dialogs";

// Today (docs/06): arrivals, departures, what needs a person, and the next two weeks.

type Today = NonNullable<ReturnType<typeof useQuery<typeof api.admin.dashboard.today>>>;
type Row = Today["arrivals"][number];

export function TodayView() {
  const data = useQuery(api.admin.dashboard.today, {});
  const [newOpen, setNewOpen] = useState(false);
  return (
    <>
      <PageHeader
        title="Today"
        subtitle={data ? formatDate(data.today) : " "}
        actions={
          <Btn variant="primary" onClick={() => setNewOpen(true)}>
            <PlusIcon aria-hidden /> New booking
          </Btn>
        }
      />
      {data === undefined ? <Loading /> : <TodayBody data={data} />}
      <NewBookingDialog open={newOpen} onOpenChange={setNewOpen} />
    </>
  );
}

function TodayBody({ data }: { data: Today }) {
  const { kpis } = data;
  return (
    <Pane>
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Kpi label="Arrivals today" value={kpis.arrivals} note={`${kpis.arrivalsCheckedIn} checked in`} />
        <Kpi label="Departures today" value={kpis.departures} note={kpis.lateCheckouts ? `${kpis.lateCheckouts} late checkout` : "On time"} noteTone={kpis.lateCheckouts ? "bad" : undefined} />
        <Kpi label="In house tonight" value={kpis.inHouse} note={`of ${plural(kpis.activeRooms, "room")}`} />
        <Kpi label="Occupancy tonight" value={`${kpis.occupancy}%`} />
        {kpis.month ? (
          <Kpi label={`Due for ${kpis.month.label} nights`} value={naira(kpis.month.amountDue)} note={`${plural(kpis.month.roomNights, "room night")}`} />
        ) : null}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Arrivals rows={data.arrivals} cutoff={data.cutoff} now={data.now} today={data.today} />
          <Departures rows={data.departures} today={data.today} />
        </div>
        <Attention data={data} />
      </div>
      <Occupancy />
    </Pane>
  );
}

function summary(r: Row): BookingSummary {
  return { id: r.id, ref: r.ref, guest: r.guest, roomType: r.roomType, roomNumber: r.roomNumber, checkIn: r.checkIn, checkOut: r.checkOut, nights: r.nights, balance: r.balance, amountDue: r.amountDue };
}

function GuestCell({ r }: { r: Row }) {
  return (
    <td className={tdClass}>
      <Link href={`/admin/reservations/${r.id}`} className="font-semibold text-ink no-underline hover:underline">
        {r.guest}
      </Link>
      <span className="block text-[13px] text-muted">{r.ref}</span>
    </td>
  );
}

function Arrivals({ rows, cutoff, now, today }: { rows: Row[]; cutoff: string; now: string; today: string }) {
  const checkIn = useMutation(api.admin.reservations.checkIn);
  const { run, pending } = useRun();
  return (
    <Panel title="Arrivals today" aside={<Link href="/admin/reservations?tab=arriving" className="text-sm font-semibold">All arrivals</Link>}>
      {rows.length === 0 ? (
        <Empty>No arrivals today.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm tabular-nums">
            <thead>
              <tr className="border-b border-line">
                <th className={thClass}>Guest</th>
                <th className={thClass}>Room</th>
                <th className={thClass}>Nights</th>
                <th className={thClass}>Payment</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const late = r.status === "reserved" && (r.lateArrivalFlag || now >= cutoff);
                return (
                  <tr key={r.id} className="border-b border-[#EEF0F0] last:border-0">
                    <GuestCell r={r} />
                    <td className={tdClass}>
                      {r.roomType} <span className="text-muted">{r.roomNumber}</span>
                    </td>
                    <td className={tdClass}>{r.nights}</td>
                    <td className={tdClass}>
                      <Pill tone={PAYMENT[r.paymentStatus].tone}>{PAYMENT[r.paymentStatus].label}</Pill>
                    </td>
                    <td className={tdClass}>
                      {r.status === "checked_in" ? (
                        <Pill tone="ok">Checked in</Pill>
                      ) : late ? (
                        <Pill tone="bad">Late · cut-off {cutoff}</Pill>
                      ) : (
                        <Pill tone="info">{r.arrivalWindow ? `Expected ${r.arrivalWindow}` : "Expected"}</Pill>
                      )}
                    </td>
                    <td className={`${tdClass} text-right`}>
                      {r.status === "reserved" ? (
                        <div className="flex justify-end gap-2">
                          {late ? (
                            <a href={`tel:${r.phone}`} className={btnClass("default")}>
                              <PhoneIcon aria-hidden /> Call guest
                            </a>
                          ) : null}
                          <Btn
                            disabled={pending || r.checkIn > today}
                            onClick={() => run(() => checkIn({ id: r.id }), `${r.guest} checked in to ${r.roomNumber}`)}
                          >
                            Check in
                          </Btn>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function Departures({ rows, today }: { rows: (Row & { lateCheckout: boolean })[]; today: string }) {
  const [checkingOut, setCheckingOut] = useState<Row | null>(null);
  return (
    <Panel title="Departures today">
      {rows.length === 0 ? (
        <Empty>No departures today.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm tabular-nums">
            <thead>
              <tr className="border-b border-line">
                <th className={thClass}>Guest</th>
                <th className={thClass}>Room</th>
                <th className={`${thClass} text-right`}>Balance</th>
                <th className={thClass}>Status</th>
                <th className={thClass}>
                  <span className="sr-only">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[#EEF0F0] last:border-0">
                  <GuestCell r={r} />
                  <td className={tdClass}>
                    {r.roomType} <span className="text-muted">{r.roomNumber}</span>
                  </td>
                  <td className={`${tdClass} text-right`}>
                    {r.balance > 0 ? <strong className="text-bad">{naira(r.balance)}</strong> : <span className="text-muted">Paid</span>}
                  </td>
                  <td className={tdClass}>
                    {r.status === "checked_out" ? (
                      <Pill tone="mute">Checked out</Pill>
                    ) : r.lateCheckout ? (
                      <Pill tone="warn">Late checkout</Pill>
                    ) : (
                      <Pill tone="ok">In house</Pill>
                    )}
                  </td>
                  <td className={`${tdClass} text-right`}>
                    {r.status === "checked_in" ? <Btn onClick={() => setCheckingOut(r)}>Check out</Btn> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {checkingOut ? (
        <CheckOutDialog open onOpenChange={(o) => !o && setCheckingOut(null)} booking={summary(checkingOut)} today={today} />
      ) : null}
    </Panel>
  );
}

function AttentionItem({ tone, label, title, children, href }: { tone: "bad" | "warn" | "info" | "mute"; label: string; title: string; children?: React.ReactNode; href?: string }) {
  return (
    <div className="flex items-start gap-3 border-t border-[#EEF0F0] px-5 py-3.5 first:border-0">
      <Pill tone={tone}>{label}</Pill>
      <div className="min-w-0 text-sm">
        {href ? (
          <Link href={href} className="font-semibold text-ink">
            {title}
          </Link>
        ) : (
          <strong>{title}</strong>
        )}
        {children ? <p className="m-0 mt-0.5 text-muted">{children}</p> : null}
      </div>
    </div>
  );
}

function Attention({ data }: { data: Today }) {
  const a = data.attention;
  const empty = !a.late.length && !a.unseen.length && !a.inquiries && !a.reviews && !a.outOfService.length;
  return (
    <Panel title="Needs attention">
      {empty ? <Empty>Nothing needs attention right now.</Empty> : null}
      {a.late.map((b) => (
        <AttentionItem key={b.id} tone="bad" label="Late" title={`${b.guest}, ${b.roomType} ${b.roomNumber}`} href={`/admin/reservations/${b.id}`}>
          {b.reason}. Call {b.phone}, then keep the room or mark a no-show.
        </AttentionItem>
      ))}
      {a.unseen.length ? (
        <AttentionItem tone="warn" label="New" title={`${plural(a.unseen.length, "website booking")} in the last 24 hours`} href="/admin/reservations?tab=attention">
          Already reserved. Open {a.unseen.length === 1 ? "it" : "them"} to see special requests.
        </AttentionItem>
      ) : null}
      {a.inquiries ? (
        <AttentionItem tone="info" label="Inquiry" title={`${plural(a.inquiries, "new message")}`} href="/admin/inquiries">
          {a.latestInquiry ? `Latest from ${a.latestInquiry.name}, ${timeAgo(a.latestInquiry.createdAt)}.` : null}
        </AttentionItem>
      ) : null}
      {a.reviews && data.role === "admin" ? (
        <AttentionItem tone="mute" label="Review" title={`${plural(a.reviews, "review")} to approve`} href="/admin/reviews" />
      ) : null}
      {a.outOfService.map((r) => (
        <AttentionItem key={r.id} tone="mute" label="Room" title={`Room ${r.number} is out of service`}>
          {r.note}
        </AttentionItem>
      ))}
    </Panel>
  );
}

function Occupancy() {
  const data = useQuery(api.admin.dashboard.occupancyNext14, {});
  if (!data) return null;
  const first = data.nights[0]?.date;
  const last = data.nights.at(-1)?.date;
  return (
    <Panel title="Occupancy, next 14 days" aside={<span className="text-sm text-muted">Amber = weekend nights</span>}>
      <figure className="m-0 px-5 pt-5 pb-4">
        <div className="flex h-40 items-end gap-1.5 border-b border-line" aria-hidden>
          {data.nights.map((n) => (
            <div key={n.date} className="group relative flex h-full flex-1 items-end" title={`${formatDateShort(n.date)}: ${n.percent}% (${n.sold} of ${data.activeRooms})`}>
              <span
                className={`block w-full rounded-t-sm ${n.weekend ? "bg-amber" : "bg-slate"}`}
                style={{ height: `${Math.max(n.percent, 1)}%` }}
              />
              <span className="pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-ink px-1.5 py-0.5 text-[11px] text-white group-hover:block">
                {n.percent}%
              </span>
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5 text-center text-[11px] text-muted tabular-nums" aria-hidden>
          {data.nights.map((n) => (
            <span key={n.date} className="flex-1">
              {Number(n.date.slice(8))}
            </span>
          ))}
        </div>
        <figcaption className="sr-only">
          Occupancy from {first ? formatDateShort(first) : ""} to {last ? formatDateShort(last) : ""}:{" "}
          {data.nights.map((n) => `${formatDateShort(n.date)} ${n.percent}%`).join(", ")}.
        </figcaption>
      </figure>
    </Panel>
  );
}
