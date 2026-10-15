"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeftIcon, ArrowRightIcon, ImagePlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { AdminOnly } from "../AdminShell";
import { Btn, Checkbox, Empty, FormField, Input, Loading, Pane, PageHeader, Panel, Pill } from "../ui";
import { Choice } from "../pickers";
import { errorText, useRun } from "../lib";
import { MIN_EDGE, useUpload } from "../upload";

// Gallery (docs/06): upload many photos at once; each needs a caption, a
// description (alt text) and a category before it can be published.

const CATEGORIES = [
  { value: "rooms", label: "Rooms" },
  { value: "suites", label: "Suites" },
  { value: "dining", label: "Dining" },
  { value: "bar", label: "Bar" },
  { value: "hotel", label: "Hotel" },
] as const;
type Category = (typeof CATEGORIES)[number]["value"];
type Item = NonNullable<ReturnType<typeof useQuery<typeof api.admin.gallery.list>>>[number];

export function GalleryView() {
  return (
    <AdminOnly>
      <Inner />
    </AdminOnly>
  );
}

function Inner() {
  const items = useQuery(api.admin.gallery.list, {});
  const types = useQuery(api.admin.rooms.listTypes, {});
  const addMany = useMutation(api.admin.gallery.addMany);
  const reorder = useMutation(api.admin.gallery.reorder);
  const upload = useUpload();
  const { run } = useRun();
  const input = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<Category>("hotel");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [filter, setFilter] = useState<"all" | "draft" | Category>("all");

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, 50);
    setProgress({ done: 0, total: list.length });
    const images: { storageId: Id<"_storage">; alt: string; width: number; height: number }[] = [];
    const warnings: string[] = [];
    for (const file of list) {
      try {
        const u = await upload(file);
        images.push({ storageId: u.storageId, alt: "", width: u.width, height: u.height });
        if (u.warning) warnings.push(`${u.name}: ${u.warning}`);
      } catch (e) {
        warnings.push(e instanceof Error && !("data" in e) ? e.message : errorText(e));
      }
      setProgress((p) => (p ? { ...p, done: p.done + 1 } : p));
    }
    if (images.length) await run(() => addMany({ images, category }), `${images.length} photo${images.length === 1 ? "" : "s"} uploaded. Describe each one, then publish.`);
    warnings.forEach((w) => toast.warning(w));
    setProgress(null);
    if (input.current) input.current.value = "";
    setFilter("draft");
  }

  const shown = (items ?? []).filter((i) => (filter === "all" ? true : filter === "draft" ? !i.published : i.category === filter));
  const move = (id: Id<"galleryImages">, d: -1 | 1) => {
    if (!items) return;
    const ids = items.map((i) => i._id);
    const at = ids.indexOf(id);
    if (at + d < 0 || at + d >= ids.length) return;
    [ids[at], ids[at + d]] = [ids[at + d], ids[at]];
    void run(() => reorder({ ids }));
  };

  return (
    <>
      <PageHeader
        title="Gallery"
        subtitle="Photos for the gallery page and the photo pickers. Real photos only."
        actions={
          <>
            <span className="flex items-center gap-2 text-sm text-muted">
              <span aria-hidden>Upload as</span>
              <Choice aria-label="Upload as category" className="w-36" value={category} onChange={(v) => setCategory(v as Category)} options={[...CATEGORIES]} />
            </span>
            <Btn variant="primary" disabled={!!progress} onClick={() => input.current?.click()}>
              <ImagePlusIcon aria-hidden /> {progress ? `Uploading ${progress.done} of ${progress.total}…` : "Upload photos"}
            </Btn>
            <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => onFiles(e.target.files)} />
          </>
        }
      />
      <Pane>
        <div role="tablist" aria-label="Filter photos" className="flex flex-wrap gap-2">
          {[{ value: "all", label: "All" }, { value: "draft", label: "Not published" }, ...CATEGORIES].map((c) => (
            <button
              key={c.value}
              role="tab"
              aria-selected={filter === c.value}
              onClick={() => setFilter(c.value as typeof filter)}
              className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${filter === c.value ? "border-ink bg-ink text-white" : "border-line-strong bg-white text-body"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        {items === undefined ? (
          <Loading />
        ) : shown.length === 0 ? (
          <Panel>
            <Empty>No photos here.</Empty>
          </Panel>
        ) : (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 p-0">
            {shown.map((item) => (
              <PhotoCard key={item._id} item={item} types={types ?? []} onMove={(d) => move(item._id, d)} />
            ))}
          </ul>
        )}
      </Pane>
    </>
  );
}

function PhotoCard({ item, types, onMove }: { item: Item; types: { id: Id<"roomTypes">; name: string }[]; onMove: (d: -1 | 1) => void }) {
  const update = useMutation(api.admin.gallery.update);
  const remove = useMutation(api.admin.gallery.remove);
  const { run, pending } = useRun();
  const [alt, setAlt] = useState(item.image.alt);
  const [caption, setCaption] = useState(item.caption);
  const [category, setCategory] = useState<Category>(item.category);
  const [roomTypeId, setRoomTypeId] = useState<string>(item.roomTypeId ?? "");
  const dirty = alt !== item.image.alt || caption !== item.caption || category !== item.category || roomTypeId !== (item.roomTypeId ?? "");
  const save = (published: boolean) =>
    run(
      () => update({ id: item._id, alt, caption, category, roomTypeId: (roomTypeId || undefined) as Id<"roomTypes"> | undefined, published }),
      published && !item.published ? "Published to the gallery" : !published && item.published ? "Hidden from the gallery" : "Saved",
    );
  const small = Math.max(item.image.width, item.image.height) < MIN_EDGE;

  return (
    <li className="flex flex-col overflow-hidden rounded-lg border border-line bg-white">
      <div className="relative aspect-[4/3] bg-mist">
        {item.url ? <Image src={item.url} alt={item.image.alt || "Photo without a description yet"} fill sizes="300px" className="object-cover" /> : null}
        <span className="absolute top-2 left-2 flex gap-1">
          {item.published ? <Pill tone="ok">Published</Pill> : <Pill tone="mute">Hidden</Pill>}
          {small ? <Pill tone="warn">Small</Pill> : null}
        </span>
      </div>
      <div className="flex flex-col gap-2.5 p-3">
        <FormField label="Description (alt text)" error={!alt.trim() ? "Needed before publishing" : null}>
          {(p) => <Input {...p} value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={200} placeholder="What's in the photo, e.g. VIP Suite bedroom with green velvet headboard" />}
        </FormField>
        <FormField label="Caption">{(p) => <Input {...p} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={120} />}</FormField>
        <div className="grid grid-cols-2 gap-2">
          <FormField label="Category">
            {(p) => (
              <Choice {...p} value={category} onChange={(v) => setCategory(v as Category)} options={[...CATEGORIES]} />
            )}
          </FormField>
          <FormField label="Room (optional)">
            {(p) => (
              <Choice {...p} value={roomTypeId} onChange={setRoomTypeId} options={[{ value: "", label: "None" }, ...types.map((t) => ({ value: t.id, label: t.name }))]} />
            )}
          </FormField>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Btn variant="ghost" className="px-2" aria-label="Move earlier" onClick={() => onMove(-1)}>
            <ArrowLeftIcon aria-hidden />
          </Btn>
          <Btn variant="ghost" className="px-2" aria-label="Move later" onClick={() => onMove(1)}>
            <ArrowRightIcon aria-hidden />
          </Btn>
          <Btn variant="ghost" className="px-2 text-bad" aria-label="Delete photo" disabled={pending} onClick={() => run(() => remove({ id: item._id }), "Photo deleted")}>
            <Trash2Icon aria-hidden />
          </Btn>
          <span className="ml-auto flex gap-1.5">
            {dirty ? (
              <Btn disabled={pending} onClick={() => save(item.published)}>
                Save
              </Btn>
            ) : null}
            <Checkbox
              label="Published"
              checked={item.published}
              disabled={pending}
              onChange={(e) => void save(e.target.checked)}
            />
          </span>
        </div>
      </div>
    </li>
  );
}
