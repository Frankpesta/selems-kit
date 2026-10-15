"use client";

import { useState } from "react";
import Image from "next/image";
import { useQuery } from "convex/react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Field } from "@/lib/content-schemas";
import { siteImage } from "@/lib/images";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Btn, Checkbox, FormField, Input, Textarea } from "../ui";

// Renders a page's fields from its schema (lib/content-schemas.ts).

type Value = Record<string, unknown>;
type Errors = Record<string, string>;

const isObj = (v: unknown): v is Value => !!v && typeof v === "object" && !Array.isArray(v);

export function FieldsEditor({ fields, value, onChange, errors, path = "" }: { fields: Field[]; value: Value; onChange: (v: Value) => void; errors: Errors; path?: string }) {
  return (
    <div className="flex flex-col gap-[18px]">
      {fields.map((f) => (
        <FieldEditor
          key={f.key}
          field={f}
          value={value[f.key]}
          onChange={(v) => onChange({ ...value, [f.key]: v })}
          errors={errors}
          path={path ? `${path}.${f.key}` : f.key}
        />
      ))}
    </div>
  );
}

function move<T>(arr: T[], i: number, d: -1 | 1) {
  const next = [...arr];
  [next[i], next[i + d]] = [next[i + d], next[i]];
  return next;
}

function FieldEditor({ field: f, value, onChange, errors, path }: { field: Field; value: unknown; onChange: (v: unknown) => void; errors: Errors; path: string }) {
  const error = errors[path] ?? null;
  switch (f.kind) {
    case "text":
      return (
        <FormField label={f.label} hint={f.help ?? (f.optional ? "Optional" : undefined)} error={error}>
          {(p) => <Input {...p} value={typeof value === "string" ? value : ""} maxLength={f.max + 50} onChange={(e) => onChange(e.target.value)} />}
        </FormField>
      );
    case "textarea": {
      const v = typeof value === "string" ? value : "";
      return (
        <FormField label={f.label} hint={<>{f.help ? <>{f.help} · </> : null}{v.length} / {f.max}</>} error={error}>
          {(p) => <Textarea {...p} rows={f.rows ?? 4} value={v} onChange={(e) => onChange(e.target.value)} />}
        </FormField>
      );
    }
    case "strings": {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      return (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[13px] font-semibold text-body">{f.label}</legend>
          {arr.map((s, i) => (
            <div key={i} className="flex gap-1.5">
              <Input aria-label={`${f.label} ${i + 1}`} value={s} onChange={(e) => onChange(arr.map((x, j) => (j === i ? e.target.value : x)))} />
              <Btn variant="ghost" className="px-2" aria-label={`Move item ${i + 1} up`} disabled={i === 0} onClick={() => onChange(move(arr, i, -1))}>
                <ArrowUpIcon aria-hidden />
              </Btn>
              <Btn variant="ghost" className="px-2 text-bad" aria-label={`Remove item ${i + 1}`} onClick={() => onChange(arr.filter((_, j) => j !== i))}>
                <Trash2Icon aria-hidden />
              </Btn>
            </div>
          ))}
          {arr.length < f.max ? (
            <Btn className="self-start" onClick={() => onChange([...arr, ""])}>
              <PlusIcon aria-hidden /> Add
            </Btn>
          ) : null}
          {error ? <p className="m-0 text-[12.5px] text-bad">{error}</p> : null}
        </fieldset>
      );
    }
    case "images":
      return <ImagesField field={f} value={Array.isArray(value) ? value : []} onChange={onChange} error={error} />;
    case "group": {
      const v = isObj(value) ? value : {};
      return (
        <fieldset className="flex flex-col gap-3 rounded-md border border-line p-4">
          <legend className="px-1 text-sm font-semibold">{f.label}</legend>
          {f.publishable ? (
            <Checkbox label="Show on the website" checked={v.published !== false} onChange={(e) => onChange({ ...v, published: e.target.checked ? undefined : false })} />
          ) : null}
          <FieldsEditor fields={f.fields} value={v} onChange={onChange} errors={errors} path={path} />
        </fieldset>
      );
    }
    case "list": {
      const arr = Array.isArray(value) ? (value as Value[]) : [];
      return (
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-semibold">{f.label}</legend>
          {f.help ? <p className="m-0 text-[12.5px] text-muted">{f.help}</p> : null}
          {arr.map((item, i) => (
            <div key={i} className="flex flex-col gap-3 rounded-md border border-line p-4">
              <div className="flex flex-wrap items-center gap-1">
                <strong className="mr-auto text-[13px]">
                  {f.itemLabel} {i + 1}
                </strong>
                {f.publishable ? (
                  <Checkbox label="Shown" checked={item.published !== false} onChange={(e) => onChange(arr.map((x, j) => (j === i ? { ...x, published: e.target.checked ? undefined : false } : x)))} />
                ) : null}
                <Btn variant="ghost" className="px-2" aria-label={`Move ${f.itemLabel} ${i + 1} up`} disabled={i === 0} onClick={() => onChange(move(arr, i, -1))}>
                  <ArrowUpIcon aria-hidden />
                </Btn>
                <Btn variant="ghost" className="px-2" aria-label={`Move ${f.itemLabel} ${i + 1} down`} disabled={i === arr.length - 1} onClick={() => onChange(move(arr, i, 1))}>
                  <ArrowDownIcon aria-hidden />
                </Btn>
                <Btn variant="ghost" className="px-2 text-bad" aria-label={`Remove ${f.itemLabel} ${i + 1}`} onClick={() => onChange(arr.filter((_, j) => j !== i))}>
                  <Trash2Icon aria-hidden />
                </Btn>
              </div>
              <FieldsEditor fields={f.fields} value={item} onChange={(v) => onChange(arr.map((x, j) => (j === i ? v : x)))} errors={errors} path={`${path}.${i}`} />
            </div>
          ))}
          {arr.length < f.max ? (
            <Btn className="self-start" onClick={() => onChange([...arr, {}])}>
              <PlusIcon aria-hidden /> Add {f.itemLabel.toLowerCase()}
            </Btn>
          ) : null}
        </fieldset>
      );
    }
  }
}

/** Image refs are "/images/…" seed paths or picked gallery images ({ url, alt, width, height }). */
function ImagesField({ field, value, onChange, error }: { field: Extract<Field, { kind: "images" }>; value: unknown[]; onChange: (v: unknown) => void; error: string | null }) {
  const [picking, setPicking] = useState<number | null>(null);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-[13px] font-semibold text-body">{field.label}</legend>
      {field.help ? <p className="m-0 text-[12.5px] text-muted">{field.help}</p> : null}
      <div className="flex flex-wrap gap-2.5">
        {value.map((ref, i) => {
          const img = siteImage(ref);
          return (
            <div key={i} className="flex flex-col gap-1">
              <button type="button" onClick={() => setPicking(i)} className="relative h-[84px] w-[120px] overflow-hidden rounded-md bg-mist" aria-label={`Change photo ${i + 1}${img ? `: ${img.alt}` : ""}`}>
                {img ? <Image src={img.url} alt={img.alt} fill sizes="120px" className="object-cover" /> : <span className="text-xs text-bad">Missing</span>}
              </button>
              <Btn variant="ghost" className="min-h-8 text-xs text-bad" onClick={() => onChange(value.filter((_, j) => j !== i))}>
                Remove
              </Btn>
            </div>
          );
        })}
        {value.length < field.max ? (
          <Btn className="h-[84px] w-[120px]" onClick={() => setPicking(value.length)}>
            Add photo
          </Btn>
        ) : null}
      </div>
      {error ? <p className="m-0 text-[12.5px] text-bad">{error}</p> : null}
      <ImagePicker
        open={picking !== null}
        onOpenChange={(o) => !o && setPicking(null)}
        onPick={(img) => {
          const next = [...value];
          next[picking!] = img;
          onChange(next);
          setPicking(null);
        }}
      />
    </fieldset>
  );
}

function ImagePicker({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (ref: unknown) => void }) {
  const photos = useQuery(api.admin.gallery.pickable, open ? {} : "skip");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose a photo</DialogTitle>
          <DialogDescription>Photos come from the Gallery. To add a new one, upload it there first and give it a description.</DialogDescription>
        </DialogHeader>
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 p-0">
          {photos?.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="flex w-full flex-col gap-1 text-left"
                onClick={() => onPick(p.image.src && !p.image.storageId ? p.image.src : { url: p.url, alt: p.image.alt, width: p.image.width, height: p.image.height })}
              >
                <span className="relative block aspect-[4/3] w-full overflow-hidden rounded-md bg-mist">
                  {p.url ? <Image src={p.url} alt={p.image.alt} fill sizes="160px" className="object-cover" /> : null}
                </span>
                <span className="line-clamp-2 text-xs text-body">{p.caption || p.image.alt}</span>
              </button>
            </li>
          ))}
        </ul>
        {photos?.length === 0 ? <p className="text-sm text-muted">No described photos in the Gallery yet.</p> : null}
      </DialogContent>
    </Dialog>
  );
}
