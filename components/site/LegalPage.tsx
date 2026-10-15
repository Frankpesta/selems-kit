import { PageIntro } from "./PageIntro";
import { paragraphs } from "@/lib/fields";

export type LegalSection = { id: string; heading: string; body: string };

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });

// Shared layout for /privacy and /terms: contents list + plain sections.
export function LegalPage({
  path,
  crumb,
  title,
  intro,
  sections,
  updatedAt,
}: {
  path: string;
  crumb: string;
  title: string;
  intro: string;
  sections: LegalSection[];
  updatedAt: number | null;
}) {
  return (
    <>
      <PageIntro crumbs={[{ name: crumb, path }]} title={title} lede={intro} className="pb-6" />
      <section className="pb-24">
        <div className="container-site grid grid-cols-1 items-start gap-12 min-[980px]:grid-cols-[240px_minmax(0,1fr)] min-[980px]:gap-16">
          <nav aria-label="Contents" className="min-[980px]:sticky min-[980px]:top-[104px]">
            <ol className="m-0 flex list-none flex-col border-l border-line p-0 text-[15px]">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="-ml-px block border-l-2 border-transparent py-2 pl-4 text-body no-underline hover:border-amber hover:text-ink">
                    {s.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <article className="flex max-w-[70ch] min-w-0 flex-col gap-10">
            {sections.map((s) => (
              <section key={s.id} className="flex flex-col gap-3">
                <h2 id={s.id} className="font-display m-0 scroll-mt-28 text-[32px]">
                  {s.heading}
                </h2>
                {paragraphs(s.body).map((p) => (
                  <p key={p.slice(0, 30)} className="m-0 text-[17px] leading-[1.7] text-body">
                    {p}
                  </p>
                ))}
              </section>
            ))}
            {updatedAt ? <p className="m-0 border-t border-line pt-6 text-sm text-muted-foreground">Last updated {dateFmt.format(updatedAt)}.</p> : null}
          </article>
        </div>
      </section>
    </>
  );
}
