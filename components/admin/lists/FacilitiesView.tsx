"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminOnly } from "../AdminShell";
import { Btn, Checkbox, Empty, FormField, Input, Loading, Pane, PageHeader, Panel, Textarea, Toggle } from "../ui";
import { errorField, errorText, useRun } from "../lib";
import { PhotoManager, toStored, type EditableImage } from "../shared";

// Facilities (docs/06): sortable list with publish toggles.

type Item = NonNullable<ReturnType<typeof useQuery<typeof api.admin.facilities.list>>>[number];

export function FacilitiesView() {
  return (
    <AdminOnly>
      <Inner />
    </AdminOnly>
  );
}

const argsOf = (f: Item, published = f.published) => ({
  title: f.title,
  body: f.body,
  icon: f.icon,
  eyebrow: f.eyebrow,
  image: f.image,
  published,
});

function Inner() {
  const items = useQuery(api.admin.facilities.list, {});
  const update = useMutation(api.admin.facilities.update);
  const reorder = useMutation(api.admin.facilities.reorder);
  const remove = useMutation(api.admin.facilities.remove);
  const { run, pending } = useRun();
  const [edit, setEdit] = useState<Item | "new" | null>(null);
  const move = (i: number, d: -1 | 1) => {
    if (!items) return;
    const ids = items.map((f) => f._id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    void run(() => reorder({ ids }), "Order saved");
  };
  return (
    <>
      <PageHeader
        title="Facilities"
        subtitle="Shown on the Facilities page in this order."
        actions={
          <Btn variant="primary" onClick={() => setEdit("new")}>
            <PlusIcon aria-hidden /> Add facility
          </Btn>
        }
      />
      <Pane>
        <Panel>
          {items === undefined ? (
            <Loading />
          ) : items.length === 0 ? (
            <Empty>No facilities yet.</Empty>
          ) : (
            <ol className="m-0 list-none p-0">
              {items.map((f, i) => (
                <li key={f._id} className="flex flex-wrap items-center gap-3 border-b border-[#EEF0F0] px-4 py-3 last:border-0">
                  <span className="flex">
                    <Btn variant="ghost" className="px-2" aria-label={`Move ${f.title} up`} disabled={i === 0 || pending} onClick={() => move(i, -1)}>
                      <ArrowUpIcon aria-hidden />
                    </Btn>
                    <Btn variant="ghost" className="px-2" aria-label={`Move ${f.title} down`} disabled={i === items.length - 1 || pending} onClick={() => move(i, 1)}>
                      <ArrowDownIcon aria-hidden />
                    </Btn>
                  </span>
                  <button type="button" className="min-h-11 min-w-0 flex-1 text-left" onClick={() => setEdit(f)}>
                    <strong className="block text-sm">{f.title}</strong>
                    <span className="line-clamp-1 text-[13px] text-muted">{f.body}</span>
                  </button>
                  <Toggle checked={f.published} label={`Show ${f.title} on the website`} disabled={pending} onChange={(on) => run(() => update({ id: f._id, ...argsOf(f, on) }), on ? "Published" : "Hidden")} />
                  <Btn variant="ghost" className="text-bad" onClick={() => run(() => remove({ id: f._id }), `${f.title} deleted`)}>
                    Delete
                  </Btn>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </Pane>
      {edit ? <FacilityDialog item={edit === "new" ? null : edit} onClose={() => setEdit(null)} /> : null}
    </>
  );
}

function FacilityDialog({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const create = useMutation(api.admin.facilities.create);
  const update = useMutation(api.admin.facilities.update);
  const [title, setTitle] = useState(item?.title ?? "");
  const [eyebrow, setEyebrow] = useState(item?.eyebrow ?? "");
  const [body, setBody] = useState(item?.body ?? "");
  const [icon, setIcon] = useState(item?.icon ?? "check");
  const [images, setImages] = useState<EditableImage[]>(item?.image ? [{ ...item.image, url: item.imageUrl }] : []);
  const [published, setPublished] = useState(item?.published ?? false);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const args = { title, eyebrow: eyebrow || undefined, body, icon, image: images[0] ? toStored(images)[0] : undefined, published };
    try {
      if (item) await update({ id: item._id, ...args });
      else await create(args);
      toast.success(`${title} saved`);
      onClose();
    } catch (e) {
      setErr({ field: errorField(e), message: errorText(e) });
    } finally {
      setSaving(false);
    }
  }
  const fe = (k: string) => (err?.field === k ? err.message : null);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{item ? `Edit: ${item.title}` : "Add a facility"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <FormField label="Title" error={fe("title")}>{(p) => <Input {...p} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />}</FormField>
          <FormField label="Label above (optional)" error={fe("eyebrow")}>{(p) => <Input {...p} value={eyebrow} onChange={(e) => setEyebrow(e.target.value)} maxLength={40} placeholder="Open 24/7" />}</FormField>
          <FormField label="Description" className="col-span-2" error={fe("body")}>{(p) => <Textarea {...p} rows={4} value={body} onChange={(e) => setBody(e.target.value)} />}</FormField>
          <FormField label="Icon name" hint="e.g. clock, wifi, car, utensils, glass, shield" className="col-span-2">{(p) => <Input {...p} value={icon} onChange={(e) => setIcon(e.target.value)} maxLength={30} />}</FormField>
          <div className="col-span-2">
            <PhotoManager single label="Photo" images={images} onChange={setImages} />
            {fe("images") ? <p className="m-0 mt-1 text-sm text-bad">{fe("images")}</p> : null}
          </div>
          <Checkbox label="Published" checked={published} onChange={(e) => setPublished(e.target.checked)} className="col-span-2" />
          {err && !["title", "eyebrow", "body", "images"].includes(err.field ?? "") ? <p className="col-span-2 m-0 text-sm text-bad">{err.message}</p> : null}
          <DialogFooter className="col-span-2 flex-row justify-end gap-2">
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn type="submit" variant="primary" disabled={saving}>
              Save
            </Btn>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
