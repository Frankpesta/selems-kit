"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { AdminOnly } from "../AdminShell";
import { Btn, Checkbox, FormField, Input, Loading, Pane, PageHeader, Panel, Textarea } from "../ui";
import { TimeField } from "../pickers";
import { errorField, errorText } from "../lib";

// Settings (docs/06, admin only). Saving refreshes every public page, because
// the hotel's name, address and phone appear site-wide.

export function SettingsView() {
  return (
    <AdminOnly>
      <Inner />
    </AdminOnly>
  );
}

function Inner() {
  const s = useQuery(api.admin.settings.get, {});
  if (s === undefined) return <Loading />;
  return <Form key={s.updatedAt} s={s} />;
}

type S = Doc<"settings">;

const str = (v: string | number | undefined | null) => (v === undefined || v === null ? "" : String(v));

function Form({ s }: { s: S }) {
  const save = useMutation(api.admin.settings.save);
  const [f, setF] = useState(() => ({
    hotelName: s.hotelName,
    street: s.address.street,
    locality: s.address.locality,
    region: s.address.region,
    country: s.address.country,
    postalCode: str(s.address.postalCode),
    lat: str(s.geo?.lat),
    lng: str(s.geo?.lng),
    phones: s.phones,
    bookingEmail: s.emails.booking,
    infoEmail: s.emails.info,
    checkInTime: str(s.checkInTime),
    checkOutTime: str(s.checkOutTime),
    noShowCutoff: s.noShowCutoff,
    autoCancelNoShows: s.autoCancelNoShows,
    cancellationPolicy: str(s.cancellationPolicy),
    freeCancellationHours: str(s.freeCancellationHours),
    childrenPolicy: str(s.childrenPolicy),
    taxNote: str(s.taxNote),
    maxNights: String(s.maxNights),
    bookingWindowDays: String(s.bookingWindowDays),
    facebook: str(s.socials.facebook),
    instagram: str(s.socials.instagram),
    x: str(s.socials.x),
    tiktok: str(s.socials.tiktok),
    googleBusinessUrl: str(s.googleBusinessUrl),
    googleReviewUrl: str(s.googleReviewUrl),
    mapEmbedUrl: str(s.mapEmbedUrl),
    gbpNap: str(s.gbpNap),
    staffAlertEmails: (s.staffAlertEmails ?? []).join(", "),
  }));
  const [initial] = useState(f);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const fe = (k: string) => (err?.field === k || err?.field?.startsWith(`${k}.`) ? err.message : null);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => dirty && e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const lat = f.lat.trim() ? Number(f.lat) : undefined;
    const lng = f.lng.trim() ? Number(f.lng) : undefined;
    if ((lat === undefined) !== (lng === undefined) || (lat !== undefined && (Number.isNaN(lat) || Number.isNaN(lng!)))) {
      return setErr({ field: "geo", message: "Enter both latitude and longitude as numbers, or leave both blank." });
    }
    setSaving(true);
    try {
      await save({
        hotelName: f.hotelName,
        address: { street: f.street, locality: f.locality, region: f.region, country: f.country, postalCode: f.postalCode || undefined },
        geo: lat !== undefined ? { lat, lng: lng! } : undefined,
        phones: f.phones,
        emails: { booking: f.bookingEmail, info: f.infoEmail },
        checkInTime: f.checkInTime || undefined,
        checkOutTime: f.checkOutTime || undefined,
        noShowCutoff: f.noShowCutoff,
        autoCancelNoShows: f.autoCancelNoShows,
        cancellationPolicy: f.cancellationPolicy || undefined,
        freeCancellationHours: f.freeCancellationHours.trim() ? Number(f.freeCancellationHours) : undefined,
        childrenPolicy: f.childrenPolicy || undefined,
        taxNote: f.taxNote || undefined,
        maxNights: Number(f.maxNights),
        bookingWindowDays: Number(f.bookingWindowDays),
        socials: { facebook: f.facebook || undefined, instagram: f.instagram || undefined, x: f.x || undefined, tiktok: f.tiktok || undefined },
        googleBusinessUrl: f.googleBusinessUrl || undefined,
        googleReviewUrl: f.googleReviewUrl || undefined,
        mapEmbedUrl: f.mapEmbedUrl || undefined,
        gbpNap: f.gbpNap || undefined,
        staffAlertEmails: f.staffAlertEmails.split(/[,\s]+/).filter(Boolean),
      });
      toast.success("Settings saved. Every page on the website refreshes within seconds.");
    } catch (e) {
      setErr({ field: errorField(e), message: errorText(e) });
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  const text = (k: keyof typeof f, label: string, opts: { hint?: ReactNode; type?: string; placeholder?: string; className?: string; field?: string } = {}) => (
    <FormField label={label} hint={opts.hint} error={fe(opts.field ?? k)} className={opts.className}>
      {(p) => <Input {...p} type={opts.type ?? "text"} placeholder={opts.placeholder} value={f[k] as string} onChange={(e) => set(k, e.target.value as never)} />}
    </FormField>
  );
  const mapQuery = encodeURIComponent([f.hotelName, f.street, f.locality, f.region].join(", "));

  return (
    <form onSubmit={submit}>
      <PageHeader
        title="Settings"
        subtitle="Hotel details, policies and booking rules."
        actions={
          <Btn type="submit" variant="primary" disabled={saving || !dirty}>
            {saving ? "Saving…" : "Save settings"}
          </Btn>
        }
      />
      <Pane>
        {err && !err.field ? <p role="alert" className="m-0 rounded-md bg-bad-bg px-3 py-2 text-sm text-bad">{err.message}</p> : null}
        <div className="grid items-start gap-6 xl:grid-cols-2">
          <Panel title="Hotel details" bodyClassName="grid gap-4 p-5 sm:grid-cols-2">
            {text("hotelName", "Hotel name", { className: "sm:col-span-2" })}
            {text("street", "Street address", { className: "sm:col-span-2", field: "address.street" })}
            {text("locality", "Town", { field: "address.locality" })}
            {text("region", "State", { field: "address.region" })}
            {text("country", "Country code", { hint: "NG for Nigeria", field: "address.country" })}
            {text("postalCode", "Postcode (optional)", { field: "address.postalCode" })}
            {text("lat", "Latitude", { placeholder: "7.2571", field: "geo" })}
            {text("lng", "Longitude", { placeholder: "5.2058", field: "geo" })}
            <p className="m-0 text-[13px] text-muted sm:col-span-2">
              <a href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`} target="_blank" rel="noreferrer">
                Pick on map
              </a>
              : right-click the hotel&rsquo;s pin in Google Maps and copy the two numbers shown.
            </p>
            {text("bookingEmail", "Bookings email", { type: "email", field: "emails.booking" })}
            {text("infoEmail", "General email", { type: "email", field: "emails.info" })}
          </Panel>

          <Panel title="Phone numbers" bodyClassName="flex flex-col gap-3 p-5">
            {f.phones.map((p, i) => (
              <div key={i} className="grid grid-cols-[1fr_1.4fr_auto_auto] items-end gap-2">
                <FormField label="Label" error={err?.field === `phones.${i}.label` ? err.message : null}>
                  {(a) => <Input {...a} value={p.label} onChange={(e) => set("phones", f.phones.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />}
                </FormField>
                <FormField label="Number" error={err?.field === `phones.${i}` ? err.message : null}>
                  {(a) => <Input {...a} type="tel" value={p.number} onChange={(e) => set("phones", f.phones.map((x, j) => (j === i ? { ...x, number: e.target.value } : x)))} />}
                </FormField>
                <Checkbox label="WhatsApp" checked={p.whatsapp} onChange={(e) => set("phones", f.phones.map((x, j) => (j === i ? { ...x, whatsapp: e.target.checked } : x)))} />
                <Btn variant="ghost" className="text-bad" aria-label={`Remove phone ${i + 1}`} disabled={f.phones.length === 1} onClick={() => set("phones", f.phones.filter((_, j) => j !== i))}>
                  <Trash2Icon aria-hidden />
                </Btn>
              </div>
            ))}
            <p className="m-0 text-[13px] text-muted">The first number is the main one shown across the website.</p>
            <Btn className="self-start" onClick={() => set("phones", [...f.phones, { label: "", number: "", whatsapp: false }])}>
              <PlusIcon aria-hidden /> Add phone
            </Btn>
          </Panel>

          <Panel title="Policies" bodyClassName="grid gap-4 p-5 sm:grid-cols-2">
            <FormField label="Check-in from" hint="“Not set” hides it on the site." error={fe("checkInTime")}>
              {(p) => <TimeField {...p} allowEmpty value={f.checkInTime} onChange={(v) => set("checkInTime", v)} />}
            </FormField>
            <FormField label="Check-out by" error={fe("checkOutTime")}>
              {(p) => <TimeField {...p} allowEmpty value={f.checkOutTime} onChange={(v) => set("checkOutTime", v)} />}
            </FormField>
            <FormField label="Cancellation policy" className="sm:col-span-2" error={fe("cancellationPolicy")}>
              {(p) => <Textarea {...p} rows={3} value={f.cancellationPolicy} onChange={(e) => set("cancellationPolicy", e.target.value)} />}
            </FormField>
            {text("freeCancellationHours", "Guests can cancel online until (hours before check-in)", { type: "number", className: "sm:col-span-2" })}
            <FormField label="Children policy" className="sm:col-span-2" error={fe("childrenPolicy")}>
              {(p) => <Textarea {...p} rows={2} value={f.childrenPolicy} onChange={(e) => set("childrenPolicy", e.target.value)} />}
            </FormField>
            {text("taxNote", "Tax note", { placeholder: "e.g. Rates include VAT", className: "sm:col-span-2" })}
          </Panel>

          <Panel title="Booking rules" bodyClassName="grid gap-4 p-5 sm:grid-cols-2">
            {text("maxNights", "Longest online stay (nights)", { type: "number" })}
            {text("bookingWindowDays", "How far ahead guests can book (days)", { type: "number" })}
            <FormField label="No-show cut-off time" hint="Guests not here by then are flagged as late." error={fe("noShowCutoff")}>
              {(p) => <TimeField {...p} value={f.noShowCutoff} onChange={(v) => set("noShowCutoff", v)} />}
            </FormField>
            <Checkbox label="Mark late arrivals as no-shows automatically and free the room" checked={f.autoCancelNoShows} onChange={(e) => set("autoCancelNoShows", e.target.checked)} className="sm:col-span-2" />
          </Panel>

          <Panel title="Links" bodyClassName="grid gap-4 p-5 sm:grid-cols-2">
            {text("instagram", "Instagram", { type: "url", placeholder: "https://", field: "socials.instagram" })}
            {text("facebook", "Facebook", { type: "url", placeholder: "https://", field: "socials.facebook" })}
            {text("x", "X (Twitter)", { type: "url", placeholder: "https://", field: "socials.x" })}
            {text("tiktok", "TikTok", { type: "url", placeholder: "https://", field: "socials.tiktok" })}
            {text("googleBusinessUrl", "Google Business Profile", { type: "url", className: "sm:col-span-2" })}
            {text("googleReviewUrl", "Google review link", { type: "url", hint: "Used in the email asking guests for a review the day after they leave.", className: "sm:col-span-2" })}
            {text("mapEmbedUrl", "Map embed link", { type: "url", className: "sm:col-span-2" })}
            <FormField label="Name, address and phone as on Google Business Profile" hint="Used by the SEO health check to spot differences." className="sm:col-span-2" error={fe("gbpNap")}>
              {(p) => <Textarea {...p} rows={2} value={f.gbpNap} onChange={(e) => set("gbpNap", e.target.value)} />}
            </FormField>
          </Panel>

          <Panel title="Alerts" bodyClassName="flex flex-col gap-4 p-5">
            {text("staffAlertEmails", "Who gets new-booking and message alerts", { hint: "Email addresses, separated by commas. Blank = the bookings email." })}
          </Panel>
        </div>
      </Pane>
    </form>
  );
}
