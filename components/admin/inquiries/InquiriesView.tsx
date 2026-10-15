"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { MailIcon, MessageCircleIcon, PhoneIcon } from "lucide-react";
import { cn } from "cn";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { formatPhone } from "@/lib/format";
import { Btn, Empty, Loading, Pane, PageHeader, Panel, Pill, Textarea, btnClass } from "../ui";
import { formatStamp, timeAgo, useRun, whatsappLink, type Tone } from "../lib";

// Inquiries inbox (docs/06): new / replied / closed.

const SUBJECT: Record<Doc<"inquiries">["subject"], { label: string; tone: Tone }> = {
  reservation: { label: "Reservation", tone: "info" },
  group: { label: "Group / event", tone: "warn" },
  request: { label: "Request", tone: "mute" },
  suggestion: { label: "Suggestion", tone: "mute" },
  testimony: { label: "Testimony", tone: "ok" },
  complaint: { label: "Complaint", tone: "bad" },
};
const TABS = [
  { key: "new", label: "New" },
  { key: "replied", label: "Replied" },
  { key: "closed", label: "Closed" },
] as const;

export function InquiriesView() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("new");
  const [open, setOpen] = useState<Id<"inquiries"> | null>(null);
  const list = useQuery(api.admin.inquiries.list, { status: tab });
  const counts = useQuery(api.admin.inquiries.counts, {});
  return (
    <>
      <PageHeader title="Inquiries" subtitle="Messages from the website contact form." />
      <Pane>
        <div role="tablist" aria-label="Inquiry status" className="flex flex-wrap gap-1 border-b border-line">
          {TABS.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => { setTab(t.key); setOpen(null); }}
              className={cn("-mb-px min-h-11 border-b-2 border-transparent px-3.5 text-sm font-semibold text-muted hover:text-ink", tab === t.key && "border-amber text-ink")}
            >
              {t.label} {counts ? <span className="tabular-nums">({counts[t.key]})</span> : null}
            </button>
          ))}
        </div>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
          <Panel>
            {list === undefined ? (
              <Loading />
            ) : list.length === 0 ? (
              <Empty>No {tab} messages.</Empty>
            ) : (
              <ul className="m-0 list-none p-0">
                {list.map((i) => (
                  <li key={i._id}>
                    <button
                      type="button"
                      onClick={() => setOpen(i._id)}
                      className={cn("flex w-full flex-col gap-1 border-b border-[#EEF0F0] px-5 py-3.5 text-left hover:bg-[#F7F8F7]", open === i._id && "bg-selected hover:bg-selected")}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <Pill tone={SUBJECT[i.subject].tone}>{SUBJECT[i.subject].label}</Pill>
                        <strong className="text-sm">{i.name}</strong>
                        <span className="ml-auto text-xs text-muted">{timeAgo(i.createdAt)}</span>
                      </span>
                      <span className="line-clamp-1 text-[13px] text-muted">{i.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {open ? (
            <Panel as="aside" aria-label="Message" bodyClassName="p-5">
              <InquiryDetail id={open} onClose={() => setOpen(null)} />
            </Panel>
          ) : null}
        </div>
      </Pane>
    </>
  );
}

function InquiryDetail({ id, onClose }: { id: Id<"inquiries">; onClose: () => void }) {
  const i = useQuery(api.admin.inquiries.get, { id });
  const setStatus = useMutation(api.admin.inquiries.setStatus);
  const setNotes = useMutation(api.admin.inquiries.setNotes);
  const { run, pending } = useRun();
  if (i === undefined) return <Loading />;
  if (i === null) return <p className="m-0 text-sm text-muted">This message was removed.</p>;
  const params = new URLSearchParams({ new: "1", name: i.name, email: i.email, phone: i.phone ?? "", note: i.message.slice(0, 400) });
  return (
    <div className="flex flex-col gap-4">
      <div>
        <Pill tone={SUBJECT[i.subject].tone}>{SUBJECT[i.subject].label}</Pill>
        <p className="m-0 mt-2 text-xl font-semibold">{i.name}</p>
        <p className="m-0 text-sm text-muted">{formatStamp(i.createdAt)}</p>
      </div>
      <p className="m-0 text-sm whitespace-pre-line">{i.message}</p>
      <div className="flex flex-wrap gap-2">
        <a className={btnClass("default")} href={`mailto:${i.email}?subject=${encodeURIComponent("Your message to Selems Hotel")}`}>
          <MailIcon aria-hidden /> Reply by email
        </a>
        {i.phone ? (
          <>
            <a className={btnClass("default")} href={`tel:${i.phone}`}>
              <PhoneIcon aria-hidden /> {formatPhone(i.phone)}
            </a>
            <a className={btnClass("default")} href={whatsappLink(i.phone)} target="_blank" rel="noreferrer">
              <MessageCircleIcon aria-hidden /> WhatsApp
            </a>
          </>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {i.status !== "replied" ? (
          <Btn variant="dark" disabled={pending} onClick={() => run(() => setStatus({ id, status: "replied" }), "Marked as replied")}>
            Mark replied
          </Btn>
        ) : null}
        {i.status !== "closed" ? (
          <Btn disabled={pending} onClick={async () => { await run(() => setStatus({ id, status: "closed" }), "Closed"); onClose(); }}>
            Close
          </Btn>
        ) : (
          <Btn disabled={pending} onClick={() => run(() => setStatus({ id, status: "new" }), "Moved back to New")}>
            Reopen
          </Btn>
        )}
        <Link className={btnClass("primary")} href={`/admin/reservations?${params.toString()}`}>
          Create booking from this
        </Link>
      </div>
      <Notes key={i._id} saved={i.notes ?? ""} pending={pending} onSave={(notes) => run(() => setNotes({ id, notes }), "Notes saved")} />
    </div>
  );
}

function Notes({ saved, onSave, pending }: { saved: string; onSave: (notes: string) => void; pending: boolean }) {
  const [notes, setNotesText] = useState(saved);
  return (
    <div className="flex flex-col gap-2 border-t border-[#EEF0F0] pt-4">
      <label htmlFor="inq-notes" className="text-[13px] font-semibold text-body">
        Internal notes
      </label>
      <Textarea id="inq-notes" rows={3} value={notes} onChange={(e) => setNotesText(e.target.value)} maxLength={2000} />
      <Btn className="self-end" disabled={pending || notes === saved} onClick={() => onSave(notes)}>
        Save notes
      </Btn>
    </div>
  );
}
