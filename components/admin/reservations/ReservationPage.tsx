"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { Pane, PageHeader, Panel } from "../ui";
import { ReservationDetail } from "./ReservationDetail";

export function ReservationPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <>
      <PageHeader title="Booking" subtitle={<Link href="/admin/reservations">All reservations</Link>} />
      <Pane>
        <Panel bodyClassName="p-5" className="max-w-3xl">
          <ReservationDetail id={id as Id<"bookings">} />
        </Panel>
      </Pane>
    </>
  );
}
