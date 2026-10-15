"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { ArrowDownIcon, ArrowUpIcon, ImagePlusIcon, Trash2Icon } from "lucide-react";
import { cn } from "cn";
import type { Id } from "@/convex/_generated/dataModel";
import { DESCRIPTION_RANGE, TITLE_RANGE } from "@/lib/content-schemas";
import { Btn, FormField, Input, Pill, Textarea } from "./ui";
import { errorText } from "./lib";
import { useUpload } from "./upload";

// Pieces shared by several admin editors.

export type EditableImage = { storageId?: Id<"_storage">; src?: string; alt: string; width: number; height: number; url?: string | null };

const counterTone = (n: number, [lo, hi]: readonly [number, number]) => (n === 0 ? "text-bad" : n >= lo && n <= hi ? "text-ok" : "text-warn");

/** Page title + meta description with live counters and a Google result preview (docs/06). */
export function SeoFields({
  title,
  description,
  onTitle,
  onDescription,
  path,
  fallbackTitle,
}: {
  title: string;
  description: string;
  onTitle: (v: string) => void;
  onDescription: (v: string) => void;
  path: string;
  fallbackTitle?: string;
}) {
  const shownTitle = title || fallbackTitle || "";
  return (
    <div className="flex flex-col gap-3.5">
      <FormField label="Page title" hint={<span className={counterTone(title.length, TITLE_RANGE)}>{title.length} / {TITLE_RANGE[1]} characters</span>}>
        {(p) => <Input {...p} value={title} onChange={(e) => onTitle(e.target.value)} maxLength={70} placeholder={fallbackTitle} />}
      </FormField>
      <FormField label="Meta description" hint={<span className={counterTone(description.length, DESCRIPTION_RANGE)}>{description.length} / {DESCRIPTION_RANGE[1]} characters</span>}>
        {(p) => <Textarea {...p} rows={3} value={description} onChange={(e) => onDescription(e.target.value)} maxLength={200} />}
      </FormField>
      <div className="rounded-md border border-line bg-white p-3.5" aria-label="Preview of the Google result" role="figure">
        <p className="m-0 text-xs text-[#4D5156]">selemsexclusivehotel.com{path === "/" ? "" : ` › ${path.slice(1).replace(/\//g, " › ")}`}</p>
        <p className="m-0 my-0.5 truncate text-lg leading-snug text-[#1A0DAB]">{shownTitle.length > 60 ? `${shownTitle.slice(0, 59)}…` : shownTitle}</p>
        <p className="m-0 line-clamp-2 text-[13px] leading-normal text-[#4D5156]">{description.length > 160 ? `${description.slice(0, 159)}…` : description}</p>
      </div>
    </div>
  );
}

/** Upload, reorder, describe and remove photos. The first photo is the cover. */
export function PhotoManager({
  images,
  onChange,
  max = 12,
  label = "Photos",
  single,
}: {
  images: EditableImage[];
  onChange: (next: EditableImage[]) => void;
  max?: number;
  label?: string;
  single?: boolean;
}) {
  const upload = useUpload();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const added: EditableImage[] = [];
    const msgs: string[] = [];
    for (const file of Array.from(files).slice(0, single ? 1 : max - images.length)) {
      try {
        const u = await upload(file);
        added.push({ storageId: u.storageId, url: u.url, width: u.width, height: u.height, alt: "" });
        if (u.warning) msgs.push(`${u.name}: ${u.warning}`);
      } catch (e) {
        msgs.push(e instanceof Error && !("data" in e) ? e.message : errorText(e));
      }
    }
    onChange(single ? added.slice(0, 1) : [...images, ...added]);
    setNotes(msgs);
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  const move = (i: number, d: -1 | 1) => {
    const next = [...images];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };
  const missing = images.findIndex((i) => !i.alt.trim());

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-sm">
          {label}
          {!single && images.length > 1 ? <span className="font-normal text-muted"> · first is the cover</span> : null}
        </strong>
        <Btn onClick={() => input.current?.click()} disabled={busy || images.length >= max}>
          <ImagePlusIcon aria-hidden /> {busy ? "Uploading…" : single && images.length ? "Replace" : "Upload"}
        </Btn>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple={!single} className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onFiles(e.target.files)} />
      </div>
      {images.length ? (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 p-0">
          {images.map((img, i) => (
            <li key={(img.storageId ?? img.src ?? "") + i} className="flex flex-col gap-1.5">
              <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-mist">
                {img.url || img.src ? (
                  <Image src={(img.url ?? img.src)!} alt={img.alt || `Photo ${i + 1} (no description yet)`} fill sizes="200px" className="object-cover" />
                ) : null}
                {i === 0 && !single ? <span className="absolute top-1.5 left-1.5 rounded bg-ink/80 px-1.5 text-[11px] font-semibold text-white">Cover</span> : null}
              </div>
              <label className="sr-only" htmlFor={`alt-${i}-${label}`}>
                Description (alt text) for photo {i + 1}
              </label>
              <Input
                id={`alt-${i}-${label}`}
                value={img.alt}
                placeholder="Describe this photo"
                aria-invalid={!img.alt.trim() || undefined}
                maxLength={200}
                className="min-h-9 text-xs"
                onChange={(e) => onChange(images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))}
              />
              <div className="flex gap-1">
                {!single ? (
                  <>
                    <Btn variant="ghost" className="min-h-9 px-2" aria-label={`Move photo ${i + 1} earlier`} disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUpIcon aria-hidden />
                    </Btn>
                    <Btn variant="ghost" className="min-h-9 px-2" aria-label={`Move photo ${i + 1} later`} disabled={i === images.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDownIcon aria-hidden />
                    </Btn>
                  </>
                ) : null}
                <Btn variant="ghost" className="ml-auto min-h-9 px-2 text-bad" aria-label={`Remove photo ${i + 1}`} onClick={() => onChange(images.filter((_, j) => j !== i))}>
                  <Trash2Icon aria-hidden />
                </Btn>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 rounded-md border border-dashed border-line-strong px-4 py-6 text-center text-sm text-muted">No photos yet.</p>
      )}
      {missing >= 0 ? (
        <p className="m-0 text-sm text-bad">
          Photo {missing + 1} needs a description before it can go live. Descriptions help Google and screen-reader users understand your photos.
        </p>
      ) : null}
      {notes.map((n) => (
        <p key={n} className="m-0 text-sm text-warn">
          {n}
        </p>
      ))}
    </div>
  );
}

/** Editable chip list (amenities, facts). */
export function ChipEditor({ values, onChange, options = [], label, placeholder }: { values: string[]; onChange: (v: string[]) => void; options?: string[]; label: string; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const all = [...new Set([...options, ...values])];
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {all.map((a) => {
          const on = values.includes(a);
          return (
            <button
              key={a}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? values.filter((x) => x !== a) : [...values, a])}
              className={cn("min-h-9 rounded-full border px-3 text-[13px] font-medium", on ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-body")}
            >
              {a}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input
          aria-label={`Add to ${label.toLowerCase()}`}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Btn onClick={add} disabled={!draft.trim()}>
          Add
        </Btn>
      </div>
    </fieldset>
  );
}

export function UnsavedPill({ dirty }: { dirty: boolean }) {
  return dirty ? <Pill tone="warn">Unsaved changes</Pill> : <Pill tone="ok">Saved</Pill>;
}

/** Strips the UI-only `url` before sending images to Convex. */
export const toStored = (images: EditableImage[]) =>
  images.map(({ storageId, src, alt, width, height }) => ({ ...(storageId ? { storageId } : {}), ...(src ? { src } : {}), alt, width, height }));
