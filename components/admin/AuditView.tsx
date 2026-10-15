"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AdminOnly } from "./AdminShell";
import { Btn, Empty, Loading, Pane, PageHeader, Panel, tdClass, thClass } from "./ui";
import { Choice } from "./pickers";
import { formatStamp } from "./lib";

// Activity log (docs/06 "Audit and safety"): who changed what, newest first.

const ENTITIES = [
  ["", "Everything"],
  ["bookings", "Bookings"],
  ["blocks", "Blocks"],
  ["roomTypes", "Room types"],
  ["rateOverrides", "Special rates"],
  ["rooms", "Rooms"],
  ["pages", "Pages"],
  ["offers", "Offers"],
  ["galleryImages", "Gallery"],
  ["faqs", "FAQs"],
  ["facilities", "Facilities"],
  ["reviews", "Reviews"],
  ["inquiries", "Inquiries"],
  ["staffProfiles", "Staff"],
  ["invites", "Invitations"],
  ["settings", "Settings"],
] as const;

export function AuditView() {
  return (
    <AdminOnly>
      <Inner />
    </AdminOnly>
  );
}

function Inner() {
  const [entity, setEntity] = useState("");
  const [limit, setLimit] = useState(100);
  const rows = useQuery(api.admin.audit.list, { limit, entity: entity || undefined });
  return (
    <>
      <PageHeader
        title="Activity log"
        subtitle="Every change staff make, newest first."
        actions={
          <Choice aria-label="Show" className="w-52" value={entity} onChange={setEntity} options={ENTITIES.map(([value, label]) => ({ value, label }))} />
        }
      />
      <Pane>
        <Panel>
          {rows === undefined ? (
            <Loading />
          ) : rows.length === 0 ? (
            <Empty>Nothing yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={thClass}>When</th>
                    <th className={thClass}>Who</th>
                    <th className={thClass}>What</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-[#EEF0F0] last:border-0">
                      <td className={`${tdClass} whitespace-nowrap text-muted tabular-nums`}>{formatStamp(r.at)}</td>
                      <td className={`${tdClass} whitespace-nowrap`}>{r.who}</td>
                      <td className={tdClass}>{r.summary}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        {rows && rows.length === limit && limit < 500 ? (
          <Btn className="self-start" onClick={() => setLimit(Math.min(limit + 100, 500))}>
            Show more
          </Btn>
        ) : null}
      </Pane>
    </>
  );
}
