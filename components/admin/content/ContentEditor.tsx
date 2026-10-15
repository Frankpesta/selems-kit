"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { cn } from "cn";
import { api } from "@/convex/_generated/api";
import { PAGE_SCHEMAS, pageSchema, seoHealth, validateFields, type PageSchema } from "@/lib/content-schemas";
import { siteImage } from "@/lib/images";
import { AdminOnly } from "../AdminShell";
import { Btn, Loading, Pane, PageHeader, Panel, Pill } from "../ui";
import { errorField, errorText, formatStamp } from "../lib";
import { SeoFields } from "../shared";
import { FieldsEditor } from "./FieldEditor";

// Content & SEO (docs/06): page copy from lib/content-schemas.ts, Google
// appearance and SEO health; save a draft, preview it, publish.

export function ContentEditor() {
  return (
    <AdminOnly>
      <Inner />
    </AdminOnly>
  );
}

function Inner() {
  const { page } = useParams<{ page: string }>();
  const schema = pageSchema(page);
  const pages = useQuery(api.admin.content.list, {});
  return (
    <>
      <div className="grid items-start lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav aria-label="Pages" className="border-line bg-white px-3 py-4 lg:sticky lg:top-0 lg:min-h-dvh lg:border-r">
          <p className="m-0 mb-1.5 px-2 text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">Pages</p>
          <ul className="m-0 flex list-none flex-row flex-wrap gap-0.5 p-0 lg:flex-col">
            {PAGE_SCHEMAS.map((p) => {
              const meta = pages?.find((x) => x.key === p.key);
              return (
                <li key={p.key}>
                  <Link
                    href={`/admin/content/${p.key}`}
                    aria-current={p.key === page ? "page" : undefined}
                    className={cn("flex min-h-11 items-center gap-2 rounded-md px-2.5 text-sm text-ink no-underline hover:bg-stone", p.key === page && "bg-stone font-semibold")}
                  >
                    {p.label}
                    {meta?.hasDraft ? <Pill tone="warn" className="ml-auto">Draft</Pill> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="m-0 mt-4 mb-1.5 px-2 text-[11px] font-semibold tracking-[0.16em] text-muted uppercase">Shared</p>
          <ul className="m-0 flex list-none flex-row flex-wrap gap-0.5 p-0 lg:flex-col">
            {[
              ["/admin/offers", "Offers"],
              ["/admin/faqs", "FAQs"],
              ["/admin/facilities", "Facilities"],
              ["/admin/gallery", "Gallery"],
              ["/admin/reviews", "Reviews"],
              ["/admin/settings", "Hotel details"],
            ].map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="flex min-h-11 items-center rounded-md px-2.5 text-sm text-ink no-underline hover:bg-stone">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0">{schema ? <PageForm key={schema.key} schema={schema} /> : <p className="p-8 text-muted">Choose a page.</p>}</div>
      </div>
    </>
  );
}

type Draft = { fields: Record<string, unknown>; seoTitle: string; seoDescription: string };

function PageForm({ schema }: { schema: PageSchema }) {
  const data = useQuery(api.admin.content.get, { key: schema.key });
  const settings = useQuery(api.admin.settings.get, {});
  const saveDraft = useMutation(api.admin.content.saveDraft);
  const publish = useMutation(api.admin.content.publish);
  const discard = useMutation(api.admin.content.discardDraft);
  const previewToken = useMutation(api.admin.content.previewToken);
  const [form, setForm] = useState<Draft | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<null | "draft" | "preview" | "publish" | "discard">(null);
  const loaded = useRef(false);

  useEffect(() => {
    if (!data || loaded.current) return;
    loaded.current = true;
    // Only the editable parts: a stored draft also carries `savedAt`.
    const src = data.draft ?? data;
    const start: Draft = { fields: src.fields, seoTitle: src.seoTitle, seoDescription: src.seoDescription };
    setForm(start);
    setSaved(JSON.stringify(start));
  }, [data]);

  const health = useMemo(() => {
    if (!form || !settings) return [];
    return seoHealth({
      schema,
      fields: form.fields,
      seoTitle: form.seoTitle,
      seoDescription: form.seoDescription,
      imageAlt: (ref) => siteImage(ref)?.alt ?? null,
      nap: { parts: [settings.hotelName, settings.address.street, settings.phones[0]?.number.slice(-10) ?? ""], gbp: settings.gbpNap ?? null },
    });
  }, [form, settings, schema]);

  if (data === undefined || !form) return <Loading />;
  if (data === null) return <p className="p-8 text-muted">This page hasn&rsquo;t been set up yet. Run the seed.</p>;

  const dirty = JSON.stringify(form) !== saved;
  const published: Draft = { fields: data.fields, seoTitle: data.seoTitle, seoDescription: data.seoDescription };
  const differsFromLive = JSON.stringify(form) !== JSON.stringify(published);

  function check(): boolean {
    const { errors: list } = validateFields(schema.fields, form!.fields);
    const next: Record<string, string> = {};
    for (const e of list) next[e.path] ??= e.message;
    setErrors(next);
    if (list.length) toast.error(list[0].message);
    return list.length === 0;
  }

  async function act(kind: "draft" | "preview" | "publish") {
    if (!check()) return;
    setBusy(kind);
    try {
      const args = { key: schema.key, fields: form!.fields, seoTitle: form!.seoTitle, seoDescription: form!.seoDescription };
      if (kind === "publish") {
        await publish(args);
        toast.success(`${schema.label} published. The live page updates within seconds.`);
      } else {
        await saveDraft(args);
        if (kind === "preview") {
          const token = await previewToken({ key: schema.key });
          window.open(`/api/preview?token=${encodeURIComponent(token)}`, "_blank", "noopener");
        } else toast.success("Draft saved. Nothing changes on the website until you publish.");
      }
      setSaved(JSON.stringify(form));
    } catch (e) {
      const field = errorField(e);
      if (field) setErrors({ [field]: errorText(e) });
      toast.error(errorText(e));
    } finally {
      setBusy(null);
    }
  }

  const issues = health.filter((h) => h.status !== "ok").length;

  return (
    <>
      <PageHeader
        title={`${schema.label} page`}
        subtitle={
          <>
            {data.updatedBy ? `Last published ${formatStamp(data.updatedAt)} by ${data.updatedBy}` : `Last published ${formatStamp(data.updatedAt)}`}
            {data.draft ? " · unpublished draft saved" : ""}
          </>
        }
        actions={
          <>
            {dirty ? <Pill tone="warn">Unsaved changes</Pill> : null}
            {data.draft ? (
              <Btn
                disabled={!!busy}
                onClick={async () => {
                  setBusy("discard");
                  try {
                    await discard({ key: schema.key });
                    setForm(published);
                    setSaved(JSON.stringify(published));
                    toast.success("Draft discarded");
                  } catch (e) {
                    toast.error(errorText(e));
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                Discard draft
              </Btn>
            ) : null}
            <Btn disabled={!!busy || !dirty} onClick={() => act("draft")}>
              Save draft
            </Btn>
            <Btn disabled={!!busy} onClick={() => act("preview")}>
              {busy === "preview" ? "Opening…" : "Preview"}
            </Btn>
            <Btn variant="primary" disabled={!!busy || !differsFromLive} onClick={() => act("publish")}>
              {busy === "publish" ? "Publishing…" : "Publish changes"}
            </Btn>
          </>
        }
      />
      <Pane>
        <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Panel title="Page content" aside={<a href={schema.path} target="_blank" rel="noreferrer" className="text-sm font-semibold">View live page</a>} bodyClassName="p-5">
            <FieldsEditor fields={schema.fields} value={form.fields} onChange={(fields) => setForm({ ...form, fields })} errors={errors} />
          </Panel>
          <div className="flex min-w-0 flex-col gap-6">
            <Panel title="Google search appearance" bodyClassName="p-5">
              <SeoFields
                title={form.seoTitle}
                description={form.seoDescription}
                onTitle={(seoTitle) => setForm({ ...form, seoTitle })}
                onDescription={(seoDescription) => setForm({ ...form, seoDescription })}
                path={schema.path}
              />
            </Panel>
            <Panel title="SEO health" aside={issues ? <Pill tone="warn">{issues} to check</Pill> : <Pill tone="ok">All good</Pill>} bodyClassName="px-5 py-2">
              <ul className="m-0 list-none p-0">
                {health.map((h) => (
                  <li key={h.id} className="flex items-start gap-2.5 border-t border-[#EEF0F0] py-2.5 text-sm first:border-0">
                    <Pill tone={h.status === "ok" ? "ok" : h.status === "warn" ? "warn" : "bad"} className="shrink-0">
                      {h.status === "ok" ? "OK" : h.status === "warn" ? "Check" : "Fix"}
                    </Pill>
                    <span>{h.message}</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <p className="m-0 text-[13px] text-muted">
              Preview opens the real page with your saved draft in a new tab for 30 minutes. <a href="/api/preview/exit">Leave preview</a> to see the live site again.
            </p>
          </div>
        </div>
      </Pane>
    </>
  );
}
