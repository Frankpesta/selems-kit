"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQuery } from "convex/react";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AdminOnly } from "../AdminShell";
import { Btn, Checkbox, Empty, FormField, Input, Loading, Pane, PageHeader, Panel, Pill, Textarea, Toggle } from "../ui";
import { errorField, errorText, useRun } from "../lib";

// FAQs (docs/06): sortable, publish toggles, choose the pages each appears on.
// Published FAQs are also marked up as FAQPage structured data on those pages.

const PAGES = [
  { key: "home", label: "Home" },
  { key: "rooms", label: "Rooms" },
  { key: "dining", label: "Dining" },
  { key: "contact", label: "Contact" },
  { key: "akure-guide", label: "Akure guide" },
];

export function FaqsView() {
  return (
    <AdminOnly>
      <Inner />
    </AdminOnly>
  );
}

function Inner() {
  const faqs = useQuery(api.admin.faqs.list, {});
  const update = useMutation(api.admin.faqs.update);
  const reorder = useMutation(api.admin.faqs.reorder);
  const remove = useMutation(api.admin.faqs.remove);
  const { run, pending } = useRun();
  const [edit, setEdit] = useState<Doc<"faqs"> | "new" | null>(null);

  const move = (i: number, d: -1 | 1) => {
    if (!faqs) return;
    const ids = faqs.map((f) => f._id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    void run(() => reorder({ ids }), "Order saved");
  };

  return (
    <>
      <PageHeader
        title="FAQs"
        subtitle="Answers shown on the website and to Google. {fromRate} and {toRate} are filled with live room prices."
        actions={
          <Btn variant="primary" onClick={() => setEdit("new")}>
            <PlusIcon aria-hidden /> Add question
          </Btn>
        }
      />
      <Pane>
        <Panel>
          {faqs === undefined ? (
            <Loading />
          ) : faqs.length === 0 ? (
            <Empty>No questions yet.</Empty>
          ) : (
            <ol className="m-0 list-none p-0">
              {faqs.map((f, i) => (
                <li key={f._id} className="flex flex-wrap items-center gap-3 border-b border-[#EEF0F0] px-4 py-3 last:border-0">
                  <span className="flex">
                    <Btn variant="ghost" className="px-2" aria-label={`Move "${f.question}" up`} disabled={i === 0 || pending} onClick={() => move(i, -1)}>
                      <ArrowUpIcon aria-hidden />
                    </Btn>
                    <Btn variant="ghost" className="px-2" aria-label={`Move "${f.question}" down`} disabled={i === faqs.length - 1 || pending} onClick={() => move(i, 1)}>
                      <ArrowDownIcon aria-hidden />
                    </Btn>
                  </span>
                  <button type="button" className="min-h-11 min-w-0 flex-1 text-left" onClick={() => setEdit(f)}>
                    <strong className="block text-sm">{f.question}</strong>
                    <span className="line-clamp-1 text-[13px] text-muted">{f.answer}</span>
                  </button>
                  <span className="flex flex-wrap gap-1">
                    {f.pages.map((p) => (
                      <Pill key={p} tone="mute">
                        {PAGES.find((x) => x.key === p)?.label ?? p}
                      </Pill>
                    ))}
                  </span>
                  <Toggle
                    checked={f.published}
                    label={`Show "${f.question}" on the website`}
                    disabled={pending}
                    onChange={(on) => run(() => update({ id: f._id, question: f.question, answer: f.answer, pages: f.pages, published: on }), on ? "Published" : "Hidden")}
                  />
                  <Btn variant="ghost" className="text-bad" onClick={() => run(() => remove({ id: f._id }), "Question deleted")}>
                    Delete
                  </Btn>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </Pane>
      {edit ? <FaqDialog faq={edit === "new" ? null : edit} onClose={() => setEdit(null)} /> : null}
    </>
  );
}

function FaqDialog({ faq, onClose }: { faq: Doc<"faqs"> | null; onClose: () => void }) {
  const create = useMutation(api.admin.faqs.create);
  const update = useMutation(api.admin.faqs.update);
  const [question, setQuestion] = useState(faq?.question ?? "");
  const [answer, setAnswer] = useState(faq?.answer ?? "");
  const [pages, setPages] = useState<string[]>(faq?.pages ?? ["home"]);
  const [published, setPublished] = useState(faq?.published ?? true);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (faq) await update({ id: faq._id, question, answer, pages, published });
      else await create({ question, answer, pages, published });
      toast.success("Question saved");
      onClose();
    } catch (e) {
      setErr({ field: errorField(e), message: errorText(e) });
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{faq ? "Edit question" : "Add a question"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <FormField label="Question" error={err?.field === "question" ? err.message : null}>{(p) => <Input {...p} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} />}</FormField>
          <FormField label="Answer" error={err?.field === "answer" ? err.message : null}>{(p) => <Textarea {...p} rows={5} value={answer} onChange={(e) => setAnswer(e.target.value)} />}</FormField>
          <fieldset>
            <legend className="mb-1 text-[13px] font-semibold text-body">Show on</legend>
            <div className="flex flex-wrap gap-x-4">
              {PAGES.map((p) => (
                <Checkbox key={p.key} label={p.label} checked={pages.includes(p.key)} onChange={(e) => setPages(e.target.checked ? [...pages, p.key] : pages.filter((x) => x !== p.key))} />
              ))}
            </div>
            {err?.field === "pages" ? <p className="m-0 text-[12.5px] text-bad">{err.message}</p> : null}
          </fieldset>
          <Checkbox label="Published" checked={published} onChange={(e) => setPublished(e.target.checked)} />
          {err && !["question", "answer", "pages"].includes(err.field ?? "") ? <p className="m-0 text-sm text-bad">{err.message}</p> : null}
          <DialogFooter className="flex-row justify-end gap-2">
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
