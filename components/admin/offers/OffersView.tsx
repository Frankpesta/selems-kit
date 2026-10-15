"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { addDays, todayLagos } from "@/lib/dates";
import { formatDate, plural } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminOnly } from "../AdminShell";
import { Btn, Checkbox, Empty, FormField, Input, Loading, Pane, PageHeader, Panel, Pill, Textarea, tdClass, thClass } from "../ui";
import { DateField } from "../pickers";
import { errorField, errorText, naira, nairaInput, toKobo, useRun, type Tone } from "../lib";
import { PhotoManager, toStored, type EditableImage } from "../shared";

// Offers (docs/06): status, form, and a live preview of the Home offer band.

type Offer = NonNullable<ReturnType<typeof useQuery<typeof api.admin.offers.list>>>[number];
const STATUS: Record<Offer["status"], { label: string; tone: Tone }> = {
  live: { label: "Live", tone: "ok" },
  scheduled: { label: "Scheduled", tone: "info" },
  expired: { label: "Expired", tone: "mute" },
  hidden: { label: "Hidden", tone: "mute" },
};
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function OffersView() {
  return (
    <AdminOnly>
      <Inner />
    </AdminOnly>
  );
}

function Inner() {
  const offers = useQuery(api.admin.offers.list, {});
  const remove = useMutation(api.admin.offers.remove);
  const { run } = useRun();
  const [edit, setEdit] = useState<Offer | "new" | null>(null);
  return (
    <>
      <PageHeader
        title="Offers"
        subtitle="Packages priced for the whole stay. Bookings that qualify get the offer price automatically."
        actions={
          <Btn variant="primary" onClick={() => setEdit("new")}>
            <PlusIcon aria-hidden /> New offer
          </Btn>
        }
      />
      <Pane>
        <Panel>
          {offers === undefined ? (
            <Loading />
          ) : offers.length === 0 ? (
            <Empty>No offers yet.</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-line">
                    <th className={thClass}>Offer</th>
                    <th className={thClass}>Stay</th>
                    <th className={`${thClass} text-right`}>Price</th>
                    <th className={thClass}>Runs</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {offers.map((o) => (
                    <tr key={o._id} className="border-b border-[#EEF0F0] last:border-0">
                      <td className={tdClass}>
                        <button type="button" className="min-h-11 text-left font-semibold" onClick={() => setEdit(o)}>
                          {o.title}
                        </button>
                        <span className="block text-xs text-muted">{o.roomNames.join(", ")}</span>
                      </td>
                      <td className={tdClass}>{plural(o.nights, "night")}</td>
                      <td className={`${tdClass} text-right`}>{naira(o.priceTotal)}</td>
                      <td className={`${tdClass} whitespace-nowrap`}>
                        {formatDate(o.validFrom)} – {formatDate(o.validTo)}
                      </td>
                      <td className={tdClass}>
                        <Pill tone={STATUS[o.status].tone}>{STATUS[o.status].label}</Pill>
                        {o.showOnHome && o.status === "live" ? <span className="ml-2 text-xs text-muted">on Home</span> : null}
                      </td>
                      <td className={`${tdClass} text-right`}>
                        <Btn variant="ghost" onClick={() => setEdit(o)}>
                          Edit
                        </Btn>
                        <Btn variant="ghost" className="text-bad" onClick={() => run(() => remove({ id: o._id }), `${o.title} deleted`)}>
                          Delete
                        </Btn>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </Pane>
      {edit ? <OfferDialog offer={edit === "new" ? null : edit} onClose={() => setEdit(null)} /> : null}
    </>
  );
}

function OfferDialog({ offer, onClose }: { offer: Offer | null; onClose: () => void }) {
  const types = useQuery(api.admin.rooms.listTypes, {});
  const create = useMutation(api.admin.offers.create);
  const update = useMutation(api.admin.offers.update);
  const today = todayLagos();
  const [f, setF] = useState({
    title: offer?.title ?? "",
    slug: offer?.slug ?? "",
    summary: offer?.summary ?? "",
    description: offer?.description ?? "",
    nights: String(offer?.nights ?? 2),
    price: nairaInput(offer?.priceTotal),
    roomTypeIds: (offer?.roomTypeIds ?? []) as Id<"roomTypes">[],
    arrivalWeekdays: offer?.arrivalWeekdays ?? [],
    validFrom: offer?.validFrom ?? today,
    validTo: offer?.validTo ?? addDays(today, 90),
    terms: offer?.terms ?? "",
    showOnHome: offer?.showOnHome ?? false,
    published: offer?.published ?? false,
    images: (offer?.image ? [{ ...offer.image, url: offer.imageUrl }] : []) as EditableImage[],
  });
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const fe = (k: string) => (err?.field === k ? err.message : null);
  const priceKobo = toKobo(f.price);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!priceKobo) return setErr({ field: "priceTotal", message: "Enter the price for the whole stay." });
    setSaving(true);
    setErr(null);
    const args = {
      title: f.title,
      slug: f.slug || f.title.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      summary: f.summary,
      description: f.description || undefined,
      nights: Number(f.nights),
      priceTotal: priceKobo,
      roomTypeIds: f.roomTypeIds,
      arrivalWeekdays: f.arrivalWeekdays.length ? f.arrivalWeekdays : undefined,
      validFrom: f.validFrom,
      validTo: f.validTo,
      image: f.images[0] ? toStored(f.images)[0] : undefined,
      terms: f.terms || undefined,
      showOnHome: f.showOnHome,
      published: f.published,
    };
    try {
      if (offer) await update({ id: offer._id, ...args });
      else await create(args);
      toast.success(`${f.title} saved`);
      onClose();
    } catch (e) {
      setErr({ field: errorField(e), message: errorText(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{offer ? `Edit: ${offer.title}` : "New offer"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="grid grid-cols-2 gap-3.5">
            <FormField label="Title" className="col-span-2" error={fe("title")}>{(p) => <Input {...p} value={f.title} onChange={(e) => set("title", e.target.value)} maxLength={90} placeholder="The long weekend: 3 nights for ₦100,000" />}</FormField>
            <FormField label="Web address" hint={`/offers/${f.slug || "…"}`} error={fe("slug")} className="col-span-2">{(p) => <Input {...p} value={f.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="long-weekend" />}</FormField>
            <FormField label="Summary" className="col-span-2" error={fe("summary")} hint={`${f.summary.length} / 240`}>{(p) => <Textarea {...p} rows={2} value={f.summary} onChange={(e) => set("summary", e.target.value)} maxLength={240} />}</FormField>
            <FormField label="Nights" error={fe("nights")}>{(p) => <Input {...p} type="number" min={1} max={30} value={f.nights} onChange={(e) => set("nights", e.target.value)} />}</FormField>
            <FormField label="Price for the whole stay (₦)" error={fe("priceTotal")}>{(p) => <Input {...p} inputMode="decimal" value={f.price} onChange={(e) => set("price", e.target.value)} />}</FormField>
            <FormField label="Starts (first night)" error={fe("validFrom")}>{(p) => <DateField {...p} value={f.validFrom} onChange={(v) => set("validFrom", v)} />}</FormField>
            <FormField label="Ends (switches off automatically)" error={fe("validTo")}>{(p) => <DateField {...p} min={f.validFrom} value={f.validTo} onChange={(v) => set("validTo", v)} />}</FormField>
            <fieldset className="col-span-2 flex flex-col gap-1">
              <legend className="mb-1 text-[13px] font-semibold text-body">Applies to</legend>
              <div className="flex flex-wrap gap-x-4">
                {types?.map((t) => (
                  <Checkbox
                    key={t.id}
                    label={t.name}
                    checked={f.roomTypeIds.includes(t.id)}
                    onChange={(e) => set("roomTypeIds", e.target.checked ? [...f.roomTypeIds, t.id] : f.roomTypeIds.filter((x) => x !== t.id))}
                  />
                ))}
              </div>
              {fe("roomTypeIds") ? <p className="m-0 text-[12.5px] text-bad">{fe("roomTypeIds")}</p> : null}
            </fieldset>
            <fieldset className="col-span-2 flex flex-col gap-1">
              <legend className="mb-1 text-[13px] font-semibold text-body">Arrival days (leave all unticked for any day)</legend>
              <div className="flex flex-wrap gap-x-4">
                {WEEKDAYS.map((d, i) => (
                  <Checkbox
                    key={d}
                    label={d}
                    checked={f.arrivalWeekdays.includes(i)}
                    onChange={(e) => set("arrivalWeekdays", e.target.checked ? [...f.arrivalWeekdays, i] : f.arrivalWeekdays.filter((x) => x !== i))}
                  />
                ))}
              </div>
            </fieldset>
            <FormField label="Description (optional)" className="col-span-2" error={fe("description")}>{(p) => <Textarea {...p} rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} />}</FormField>
            <FormField label="Terms (optional)" className="col-span-2" error={fe("terms")}>{(p) => <Textarea {...p} rows={3} value={f.terms} onChange={(e) => set("terms", e.target.value)} />}</FormField>
            <div className="col-span-2">
              <PhotoManager single label="Photo" images={f.images} onChange={(v) => set("images", v)} />
            </div>
            <Checkbox label="Show on the Home page" checked={f.showOnHome} onChange={(e) => set("showOnHome", e.target.checked)} />
            <Checkbox label="Published" checked={f.published} onChange={(e) => set("published", e.target.checked)} />
            {err && !err.field ? <p role="alert" className="col-span-2 m-0 rounded-md bg-bad-bg px-3 py-2 text-sm text-bad">{err.message}</p> : null}
            {err?.field === "images" ? <p className="col-span-2 m-0 text-sm text-bad">{err.message}</p> : null}
            <div className="col-span-2 flex justify-end gap-2 border-t border-line pt-4">
              <Btn onClick={onClose}>Cancel</Btn>
              <Btn type="submit" variant="primary" disabled={saving}>
                {saving ? "Saving…" : "Save offer"}
              </Btn>
            </div>
          </div>
          <aside aria-label="Preview of the Home offer band" className="flex flex-col gap-2">
            <p className="m-0 text-[13px] font-semibold text-body">Preview on Home</p>
            <div className="bg-velvet p-6 text-stone">
              <p className="m-0 text-[11px] font-semibold tracking-[0.18em] text-amber-tint uppercase">Offer · {plural(Number(f.nights) || 0, "night")}</p>
              <p className="m-0 mt-2 font-display text-[28px] leading-tight text-stone">{f.title || "Offer title"}</p>
              <p className="m-0 mt-2 text-sm text-stone/85">{f.summary || "Summary"}</p>
              <p className="m-0 mt-3 text-sm">
                <strong className="text-lg tabular-nums">{priceKobo ? naira(priceKobo) : "₦–"}</strong> for the stay
              </p>
              <p className="m-0 mt-1 text-xs text-stone/70">Until {f.validTo ? formatDate(f.validTo) : "–"}</p>
            </div>
            {!f.showOnHome ? <p className="m-0 text-xs text-muted">Not shown on Home: tick &ldquo;Show on the Home page&rdquo;.</p> : null}
          </aside>
        </form>
      </DialogContent>
    </Dialog>
  );
}
