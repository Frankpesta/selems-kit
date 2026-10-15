import type { Metadata } from "next";
import { LegalPage, type LegalSection } from "@/components/site/LegalPage";
import { getPage, getSettings } from "@/lib/data";
import { arr, str } from "@/lib/fields";
import { formatTime } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("terms");
  return pageMetadata({
    title: page?.seoTitle ?? "Booking terms | Selems Exclusive Hotel & Suites, Akure",
    description: page?.seoDescription ?? "",
    path: "/terms",
  });
}

export default async function TermsPage() {
  const [page, s] = await Promise.all([getPage("terms"), getSettings()]);
  const f = page?.fields ?? {};
  const base = arr<LegalSection>(f.sections).filter((x) => x.id && x.heading && x.body);

  // Rules that live in Settings, so the terms always match what the system enforces.
  const times =
    s.checkInTime || s.checkOutTime
      ? [s.checkInTime ? `Check-in is from ${formatTime(s.checkInTime)}.` : "", s.checkOutTime ? `Check-out is by ${formatTime(s.checkOutTime)}.` : ""]
          .filter(Boolean)
          .join(" ")
      : "";
  const cancellation = [
    s.cancellationPolicy ?? "",
    s.freeCancellationHours
      ? `You can cancel online, using the link in your confirmation email, until ${s.freeCancellationHours} hours before check-in. After that, please call or WhatsApp the front office.`
      : "You can cancel online, using the link in your confirmation email, until your check-in time. After that, please call or WhatsApp the front office.",
  ]
    .filter(Boolean)
    .join("\n\n");
  const arrival = `If you have not arrived by ${formatTime(s.noShowCutoff)} on your arrival day and have not told us you are running late, we may ${
    s.autoCancelNoShows ? "cancel the booking and release the room" : "release the room"
  }. If you will be late, call or WhatsApp the front office and we will hold it.`;

  const dynamic: LegalSection[] = [
    ...(times ? [{ id: "times", heading: "Check-in and check-out times", body: times }] : []),
    { id: "arrival", heading: "Late arrival and no-shows", body: arrival },
    { id: "cancellation", heading: "Cancelling", body: cancellation },
    ...(s.childrenPolicy ? [{ id: "children", heading: "Children and extra guests", body: s.childrenPolicy }] : []),
    ...(s.taxNote ? [{ id: "taxes", heading: "Taxes", body: s.taxNote }] : []),
  ];
  const at = base.findIndex((x) => x.id === "checkin");
  const sections = at >= 0 ? [...base.slice(0, at + 1), ...dynamic, ...base.slice(at + 1)] : [...base, ...dynamic];

  return (
    <LegalPage
      path="/terms"
      crumb="Booking terms"
      title={str(f.h1, "Booking terms")}
      intro={str(f.intro)}
      sections={sections}
      updatedAt={Math.max(page?.updatedAt ?? 0, s.updatedAt)}
    />
  );
}
