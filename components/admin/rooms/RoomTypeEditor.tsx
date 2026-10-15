"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { ExternalLinkIcon, Trash2Icon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { addDays, todayLagos } from "@/lib/dates";
import { formatDateShort } from "@/lib/format";
import { AdminOnly } from "../AdminShell";
import { Btn, Checkbox, FormField, Input, Loading, Pane, PageHeader, Panel, Textarea, Toggle, btnClass } from "../ui";
import { Choice, DateField } from "../pickers";
import { errorField, errorText, naira, nairaInput, toKobo, useRun } from "../lib";
import { ChipEditor, PhotoManager, SeoFields, UnsavedPill, toStored, type EditableImage } from "../shared";
import { toast } from "sonner";

// Edit one room type (docs/06 "Edit room type").

type Loaded = NonNullable<ReturnType<typeof useQuery<typeof api.admin.rooms.getType>>>;

type Form = {
  name: string;
  slug: string;
  category: "room" | "suite";
  baseRate: string;
  weekendRate: string;
  maxAdults: string;
  maxChildren: string;
  sizeSqm: string;
  facts: string[];
  amenities: string[];
  shortDescription: string;
  description: string;
  images: EditableImage[];
  featured: boolean;
  seoTitle: string;
  seoDescription: string;
};

const toForm = (t: Loaded): Form => ({
  name: t.name,
  slug: t.slug,
  category: t.category,
  baseRate: nairaInput(t.baseRate),
  weekendRate: nairaInput(t.weekendRate),
  maxAdults: String(t.maxAdults),
  maxChildren: String(t.maxChildren),
  sizeSqm: t.sizeSqm ? String(t.sizeSqm) : "",
  facts: t.facts,
  amenities: t.amenities,
  shortDescription: t.shortDescription,
  description: t.description,
  images: t.images,
  featured: t.featured,
  seoTitle: t.seoTitle ?? "",
  seoDescription: t.seoDescription ?? "",
});

export function RoomTypeEditor() {
  return (
    <AdminOnly>
      <Inner />
    </AdminOnly>
  );
}

function Inner() {
  const { id } = useParams<{ id: string }>();
  const t = useQuery(api.admin.rooms.getType, { id: id as Id<"roomTypes"> });
  if (t === undefined) return <Loading />;
  if (t === null) return <p className="p-8 text-muted">That room type doesn&rsquo;t exist.</p>;
  return <Editor key={t._id} t={t} />;
}

function Editor({ t }: { t: Loaded }) {
  const update = useMutation(api.admin.rooms.updateType);
  const setPublished = useMutation(api.admin.rooms.setPublished);
  const { run, pending } = useRun();
  const initial = useMemo(() => toForm(t), [t]);
  const [f, setF] = useState<Form>(initial);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);
  const dirty = JSON.stringify(f) !== JSON.stringify(initial);
  // Saves from another device show up here unless there are local edits.
  const latest = useRef(initial);
  useEffect(() => {
    if (JSON.stringify(f) === JSON.stringify(latest.current)) setF(initial);
    latest.current = initial;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));
  const fieldErr = (k: string) => (err?.field === k ? err.message : null);

  async function save(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const baseRate = toKobo(f.baseRate);
    if (!baseRate) return setErr({ field: "baseRate", message: "Enter the weekday rate, e.g. 70,000." });
    const weekendRate = f.weekendRate.trim() ? toKobo(f.weekendRate) : undefined;
    if (weekendRate === null) return setErr({ field: "weekendRate", message: "Enter the weekend rate, or leave it blank to use the weekday rate." });
    setSaving(true);
    try {
      await update({
        id: t._id,
        name: f.name,
        slug: f.slug,
        category: f.category,
        baseRate,
        weekendRate,
        maxAdults: Number(f.maxAdults),
        maxChildren: Number(f.maxChildren),
        sizeSqm: f.sizeSqm.trim() ? Number(f.sizeSqm) : undefined,
        facts: f.facts,
        amenities: f.amenities,
        shortDescription: f.shortDescription,
        description: f.description,
        images: toStored(f.images),
        featured: f.featured,
        seoTitle: f.seoTitle || undefined,
        seoDescription: f.seoDescription || undefined,
      });
      // Convex has already delivered the saved version to `initial` by now.
      setF(latest.current);
      toast.success(`${f.name} saved. The website updates within seconds.`);
    } catch (e) {
      setErr({ field: errorField(e), message: errorText(e) });
      toast.error(errorText(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save}>
      <PageHeader
        title={`Edit: ${t.name}`}
        subtitle={<Link href="/admin/rooms">All room types</Link>}
        actions={
          <>
            <UnsavedPill dirty={dirty} />
            <label className="flex items-center gap-1 text-sm font-semibold">
              On website
              <Toggle
                checked={t.published}
                label={`${t.name} shown on website`}
                disabled={pending || dirty}
                onChange={(on) => run(() => setPublished({ id: t._id, published: on }), on ? `${t.name} is live` : `${t.name} is hidden`)}
              />
            </label>
            {t.published ? (
              <a href={`/rooms/${t.slug}`} target="_blank" rel="noreferrer" className={btnClass("default")}>
                <ExternalLinkIcon aria-hidden /> View page
              </a>
            ) : null}
            <Btn onClick={() => { setF(initial); setErr(null); }} disabled={!dirty}>
              Discard
            </Btn>
            <Btn type="submit" variant="primary" disabled={saving || !dirty}>
              {saving ? "Saving…" : "Save changes"}
            </Btn>
          </>
        }
      />
      <Pane>
        {dirty && t.published ? <p className="m-0 text-sm text-muted">Turn &ldquo;On website&rdquo; on or off after saving.</p> : null}
        {err && !err.field ? <p role="alert" className="m-0 rounded-md bg-bad-bg px-3 py-2 text-sm text-bad">{err.message}</p> : null}
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-6">
            <Panel title="Details" bodyClassName="grid gap-4 p-5 sm:grid-cols-2">
              <FormField label="Room name" error={fieldErr("name")}>{(p) => <Input {...p} value={f.name} onChange={(e) => set("name", e.target.value)} />}</FormField>
              <FormField label="Web address" hint={f.slug !== t.slug ? `The old address /rooms/${t.slug} will redirect here.` : undefined} error={fieldErr("slug")}>
                {(p) => (
                  <div className="flex items-center">
                    <span className="rounded-l-md border border-r-0 border-line-strong bg-stone px-2.5 py-2.5 text-sm text-muted">/rooms/</span>
                    <Input {...p} className="rounded-l-none" value={f.slug} onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))} />
                  </div>
                )}
              </FormField>
              <FormField label="Weekday rate (₦)" error={fieldErr("baseRate")}>{(p) => <Input {...p} inputMode="decimal" className="tabular-nums" value={f.baseRate} onChange={(e) => set("baseRate", e.target.value)} />}</FormField>
              <FormField label="Weekend rate, Fri–Sat nights (₦)" hint="Leave blank to charge the weekday rate." error={fieldErr("weekendRate")}>
                {(p) => <Input {...p} inputMode="decimal" className="tabular-nums" value={f.weekendRate} onChange={(e) => set("weekendRate", e.target.value)} />}
              </FormField>
              <FormField label="Category">
                {(p) => (
                  <Choice
                    {...p}
                    value={f.category}
                    onChange={(v) => set("category", v as Form["category"])}
                    options={[
                      { value: "room", label: "Room" },
                      { value: "suite", label: "Suite" },
                    ]}
                  />
                )}
              </FormField>
              <FormField label="Size (m², optional)" error={fieldErr("sizeSqm")}>{(p) => <Input {...p} inputMode="numeric" value={f.sizeSqm} onChange={(e) => set("sizeSqm", e.target.value)} />}</FormField>
              <FormField label="Maximum adults" error={fieldErr("maxAdults")}>{(p) => <Input {...p} type="number" min={1} max={12} value={f.maxAdults} onChange={(e) => set("maxAdults", e.target.value)} />}</FormField>
              <FormField label="Maximum children" error={fieldErr("maxChildren")}>{(p) => <Input {...p} type="number" min={0} max={12} value={f.maxChildren} onChange={(e) => set("maxChildren", e.target.value)} />}</FormField>
              <Checkbox label="Feature on the Home page" checked={f.featured} onChange={(e) => set("featured", e.target.checked)} className="sm:col-span-2" />
            </Panel>

            <Panel title="Photos" bodyClassName="p-5">
              <PhotoManager images={f.images} onChange={(v) => set("images", v)} />
              {fieldErr("images") ? <p className="m-0 mt-2 text-sm text-bad">{fieldErr("images")}</p> : null}
            </Panel>

            <Panel title="Descriptions" bodyClassName="flex flex-col gap-4 p-5">
              <FormField label="Card description" hint={`${f.shortDescription.length} / 240 · shown on room cards`} error={fieldErr("shortDescription")}>
                {(p) => <Textarea {...p} rows={2} maxLength={240} value={f.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} />}
              </FormField>
              <FormField label="Page description" error={fieldErr("description")}>{(p) => <Textarea {...p} rows={6} value={f.description} onChange={(e) => set("description", e.target.value)} />}</FormField>
              <ChipEditor label="Quick facts" values={f.facts} onChange={(v) => set("facts", v)} placeholder="e.g. Separate lounge" />
              <ChipEditor label="Amenities" values={f.amenities} options={t.amenityOptions} onChange={(v) => set("amenities", v)} placeholder="Add an amenity" />
            </Panel>
          </div>

          <div className="flex min-w-0 flex-col gap-6">
            <Panel title="Google search appearance" bodyClassName="p-5">
              <SeoFields
                title={f.seoTitle}
                description={f.seoDescription}
                onTitle={(v) => set("seoTitle", v)}
                onDescription={(v) => set("seoDescription", v)}
                path={`/rooms/${f.slug}`}
                fallbackTitle={`${f.name} in Akure | Selems Hotel`}
              />
            </Panel>
            <SpecialRates roomTypeId={t._id} overrides={t.overrides} />
          </div>
        </div>
      </Pane>
    </form>
  );
}

function SpecialRates({ roomTypeId, overrides }: { roomTypeId: Id<"roomTypes">; overrides: Doc<"rateOverrides">[] }) {
  const create = useMutation(api.admin.rooms.createOverride);
  const update = useMutation(api.admin.rooms.updateOverride);
  const remove = useMutation(api.admin.rooms.removeOverride);
  const { run, pending } = useRun();
  const today = todayLagos();
  const empty = { id: null as Id<"rateOverrides"> | null, startDate: today, endDate: addDays(today, 1), rate: "", label: "" };
  const [edit, setEdit] = useState<typeof empty | null>(null);

  async function submit() {
    if (!edit) return;
    const rate = toKobo(edit.rate);
    if (!rate) return toast.error("Enter the rate, e.g. 85,000.");
    const args = { startDate: edit.startDate, endDate: edit.endDate, rate, label: edit.label };
    const ok = await run(() => (edit.id ? update({ id: edit.id, ...args }) : create({ roomTypeId, ...args })), `Special rate saved: ${edit.label}`);
    if (ok !== undefined) setEdit(null);
  }

  const past = (o: Doc<"rateOverrides">) => o.endDate < today;

  return (
    <Panel title="Special-date rates" aside={!edit ? <Btn onClick={() => setEdit(empty)}>Add date range</Btn> : null} bodyClassName="flex flex-col gap-3 p-5">
      <p className="m-0 text-sm text-muted">Override the nightly rate for festive seasons, convocations or big events. Ranges can&rsquo;t overlap.</p>
      {overrides.length ? (
        <ul className="m-0 flex list-none flex-col p-0 text-sm">
          {overrides.map((o) => (
            <li key={o._id} className={`flex items-center justify-between gap-3 border-t border-[#EEF0F0] py-2 first:border-0 ${past(o) ? "opacity-60" : ""}`}>
              <button
                type="button"
                className="min-h-11 min-w-0 text-left"
                onClick={() => setEdit({ id: o._id, startDate: o.startDate, endDate: o.endDate, rate: nairaInput(o.rate), label: o.label })}
              >
                <strong className="block">{o.label}</strong>
                <span className="text-muted">
                  Nights {formatDateShort(o.startDate)} – {formatDateShort(o.endDate)}
                  {past(o) ? " · ended" : ""}
                </span>
              </button>
              <span className="flex items-center gap-1 tabular-nums">
                {naira(o.rate)}
                <Btn variant="ghost" className="px-2 text-bad" aria-label={`Remove ${o.label}`} disabled={pending} onClick={() => run(() => remove({ id: o._id }), `${o.label} removed`)}>
                  <Trash2Icon aria-hidden />
                </Btn>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {edit ? (
        <div className="grid grid-cols-2 gap-3 rounded-md border border-line p-3">
          <FormField label="Name" className="col-span-2">{(p) => <Input {...p} value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} maxLength={60} placeholder="e.g. Festive season" />}</FormField>
          <FormField label="First night">{(p) => <DateField {...p} value={edit.startDate} onChange={(d) => setEdit({ ...edit, startDate: d, endDate: edit.endDate < d ? d : edit.endDate })} />}</FormField>
          <FormField label="Last night">{(p) => <DateField {...p} min={edit.startDate} value={edit.endDate} onChange={(d) => setEdit({ ...edit, endDate: d })} />}</FormField>
          <FormField label="Nightly rate (₦)" className="col-span-2">{(p) => <Input {...p} inputMode="decimal" value={edit.rate} onChange={(e) => setEdit({ ...edit, rate: e.target.value })} />}</FormField>
          <div className="col-span-2 flex justify-end gap-2">
            <Btn onClick={() => setEdit(null)}>Cancel</Btn>
            <Btn variant="primary" disabled={pending || !edit.label.trim()} onClick={submit}>
              Save rate
            </Btn>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}
