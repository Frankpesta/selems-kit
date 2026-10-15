"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { PlusIcon, StarIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminOnly } from "../AdminShell";
import { Btn, Checkbox, Empty, FormField, Input, Loading, Pane, PageHeader, Panel, Pill, Textarea } from "../ui";
import { Choice, MonthField } from "../pickers";
import { errorField, errorText, formatDay, useRun } from "../lib";
import { todayLagos } from "@/lib/dates";

// Reviews (docs/06). Paste Google reviews with the guest's permission (first
// name and month only), approve emailed ones, feature up to six on Home.

export function ReviewsView() {
  return (
    <AdminOnly>
      <Inner />
    </AdminOnly>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex text-amber" role="img" aria-label={`${n} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon key={i} className={`size-4 ${i < n ? "fill-current" : "opacity-30"}`} aria-hidden />
      ))}
    </span>
  );
}

function Inner() {
  const reviews = useQuery(api.admin.reviews.list, {});
  const setState = useMutation(api.admin.reviews.setState);
  const remove = useMutation(api.admin.reviews.remove);
  const { run, pending } = useRun();
  const [edit, setEdit] = useState<Doc<"reviews"> | "new" | null>(null);
  const featured = reviews?.filter((r) => r.featured).length ?? 0;
  return (
    <>
      <PageHeader
        title="Reviews"
        subtitle={`${featured} of 6 featured on the Home page.`}
        actions={
          <Btn variant="primary" onClick={() => setEdit("new")}>
            <PlusIcon aria-hidden /> Add a review
          </Btn>
        }
      />
      <Pane>
        <Panel>
          {reviews === undefined ? (
            <Loading />
          ) : reviews.length === 0 ? (
            <Empty>No reviews yet. Paste in Google reviews (with the guest&rsquo;s permission) to show them on the website.</Empty>
          ) : (
            <ul className="m-0 list-none p-0">
              {reviews.map((r) => (
                <li key={r._id} className="flex flex-col gap-2 border-b border-[#EEF0F0] px-5 py-4 last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars n={r.rating} />
                    <strong className="text-sm">{r.authorName}</strong>
                    <span className="text-[13px] text-muted">
                      {r.source === "google" ? "Google" : r.source === "email" ? "Email" : "Website"} · {r.stayMonth ?? formatDay(r.createdAt)}
                    </span>
                    {!r.approved ? <Pill tone="warn">Awaiting approval</Pill> : r.featured ? <Pill tone="ok">Featured</Pill> : <Pill tone="mute">Approved</Pill>}
                  </div>
                  {r.title ? <p className="m-0 text-sm font-semibold">{r.title}</p> : null}
                  <p className="m-0 text-sm whitespace-pre-line text-body">{r.body}</p>
                  <div className="flex flex-wrap gap-2">
                    {!r.approved ? (
                      <Btn variant="dark" disabled={pending} onClick={() => run(() => setState({ id: r._id, approved: true, featured: false }), "Approved")}>
                        Approve
                      </Btn>
                    ) : (
                      <Btn disabled={pending} onClick={() => run(() => setState({ id: r._id, approved: true, featured: !r.featured }), r.featured ? "No longer featured" : "Featured on Home")}>
                        {r.featured ? "Unfeature" : "Feature on Home"}
                      </Btn>
                    )}
                    {r.approved ? (
                      <Btn variant="ghost" disabled={pending} onClick={() => run(() => setState({ id: r._id, approved: false, featured: false }), "Hidden")}>
                        Unapprove
                      </Btn>
                    ) : null}
                    <Btn variant="ghost" onClick={() => setEdit(r)}>
                      Edit
                    </Btn>
                    <Btn variant="ghost" className="text-bad" onClick={() => run(() => remove({ id: r._id }), "Review deleted")}>
                      Delete
                    </Btn>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </Pane>
      {edit ? <ReviewDialog review={edit === "new" ? null : edit} onClose={() => setEdit(null)} /> : null}
    </>
  );
}

function ReviewDialog({ review, onClose }: { review: Doc<"reviews"> | null; onClose: () => void }) {
  const create = useMutation(api.admin.reviews.create);
  const update = useMutation(api.admin.reviews.update);
  const [f, setF] = useState({
    source: review?.source ?? ("google" as const),
    authorName: review?.authorName ?? "",
    rating: String(review?.rating ?? 5),
    title: review?.title ?? "",
    body: review?.body ?? "",
    stayMonth: review?.stayMonth ?? "",
  });
  const [permission, setPermission] = useState(!!review);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const args = { source: f.source, authorName: f.authorName, rating: Number(f.rating), title: f.title || undefined, body: f.body, stayMonth: f.stayMonth || undefined };
    try {
      if (review) await update({ id: review._id, ...args });
      else await create(args);
      toast.success("Review saved");
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{review ? "Edit review" : "Add a review"}</DialogTitle>
          <DialogDescription>Use the guest&rsquo;s first name only. Copy the words exactly as written.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-4">
          <FormField label="Where it's from">
            {(p) => (
              <Choice
                {...p}
                value={f.source}
                onChange={(v) => setF({ ...f, source: v as typeof f.source })}
                options={[
                  { value: "google", label: "Google" },
                  { value: "email", label: "Email to the hotel" },
                  { value: "website", label: "Website" },
                ]}
              />
            )}
          </FormField>
          <FormField label="Rating">
            {(p) => (
              <Choice {...p} value={f.rating} onChange={(v) => setF({ ...f, rating: v })} options={[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: `${n} star${n === 1 ? "" : "s"}` }))} />
            )}
          </FormField>
          <FormField label="Guest's first name" error={fe("authorName")}>{(p) => <Input {...p} value={f.authorName} onChange={(e) => setF({ ...f, authorName: e.target.value })} maxLength={40} />}</FormField>
          <FormField label="Month of stay (optional)" error={fe("stayMonth")}>{(p) => <MonthField {...p} today={todayLagos()} value={f.stayMonth} onChange={(v) => setF({ ...f, stayMonth: v })} />}</FormField>
          <FormField label="Title (optional)" className="col-span-2">{(p) => <Input {...p} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={100} />}</FormField>
          <FormField label="Review" className="col-span-2" error={fe("body")}>{(p) => <Textarea {...p} rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />}</FormField>
          {!review ? <Checkbox className="col-span-2" label="The guest has agreed to us showing this review on our website" checked={permission} onChange={(e) => setPermission(e.target.checked)} /> : null}
          {err && !["authorName", "stayMonth", "body"].includes(err.field ?? "") ? <p className="col-span-2 m-0 text-sm text-bad">{err.message}</p> : null}
          <DialogFooter className="col-span-2 flex-row justify-end gap-2">
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn type="submit" variant="primary" disabled={saving || !permission}>
              Save
            </Btn>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
