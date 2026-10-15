import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs, Faq } from "@/components/site/blocks";
import { JsonLd } from "@/components/seo/JsonLd";
import { HeroImage, HeroRise } from "@/components/motion/HeroIntro";
import { Reveal } from "@/components/motion/Reveal";
import { STAGGER } from "@/components/motion/tokens";
import { getFaqs, getPage, getRooms, getSettings } from "@/lib/data";
import { arr, paragraphs, str } from "@/lib/fields";
import { siteImage } from "@/lib/images";
import { formatNaira } from "@/lib/money";
import { articleJsonLd, pageMetadata } from "@/lib/seo";

type Section = { id?: string; heading?: string; body?: string; areas?: { name?: string; body?: string }[] };

const HERO = "/images/selems-hotel-akure-exterior-wide.jpg";
const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" });
const isoDate = (ms: number) => new Date(ms + 3_600_000).toISOString().slice(0, 10);

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("akure-guide");
  return pageMetadata({
    title: page?.seoTitle ?? "Where to Stay in Akure | Selems Hotel",
    description: page?.seoDescription ?? "",
    path: "/akure-guide",
    image: siteImage(HERO),
  });
}

export default async function AkureGuidePage() {
  const [page, rooms, faqs, settings] = await Promise.all([getPage("akure-guide"), getRooms(), getFaqs("akure-guide"), getSettings()]);
  const f = page?.fields ?? {};
  const title = str(f.h1, "Where to stay in Akure: a visitor's guide");
  const intro = str(f.intro);
  const author = str(f.author);
  const sections = arr<Section>(f.sections).filter((s) => s.id && s.heading && (s.body || s.areas?.length));
  const hero = siteImage(HERO);
  const updated = page?.updatedAt ?? settings.updatedAt;
  const words = [intro, ...sections.flatMap((s) => [s.body ?? "", ...(s.areas ?? []).map((a) => `${a.name} ${a.body}`)])].join(" ").split(/\s+/).length;
  const minutes = Math.max(2, Math.round(words / 200));
  const fromRate = rooms.length ? formatNaira(Math.min(...rooms.map((r) => r.fromRate))) : null;

  return (
    <>
      <section className="pt-10 pb-10 min-[760px]:pt-14">
        <div className="container-site flex max-w-[960px] flex-col gap-6">
          <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Akure guide", path: "/akure-guide" }]} />
          <HeroRise order={0}>
            <h1 className="font-display text-page m-0">{title}</h1>
          </HeroRise>
          {intro ? (
            <HeroRise order={1}>
              <p className="lede m-0">{intro}</p>
            </HeroRise>
          ) : null}
          <HeroRise order={2}>
            <p className="m-0 text-sm text-muted-foreground">
              By {author || `the team at ${settings.hotelName}`} · Updated <time dateTime={isoDate(updated)}>{dateFmt.format(updated)}</time> ·{" "}
              {minutes} min read
            </p>
          </HeroRise>
        </div>
        {hero ? (
          <div className="container-site mt-10">
            <HeroImage className="aspect-[16/9] min-[980px]:aspect-[21/9]">
              <Image src={hero.url} alt={hero.alt} width={hero.width} height={hero.height} priority fetchPriority="high" sizes="(min-width: 1240px) 1240px, 100vw" className="h-full w-full object-cover" />
            </HeroImage>
          </div>
        ) : null}
      </section>

      <section className="pb-24">
        <div className="container-site grid grid-cols-1 items-start gap-12 min-[980px]:grid-cols-[240px_minmax(0,1fr)] min-[980px]:gap-16">
          <nav aria-label="On this page" className="min-[980px]:sticky min-[980px]:top-[104px]">
            <p className="eyebrow m-0 mb-3">On this page</p>
            <ol className="m-0 flex list-none flex-col border-l border-line p-0 text-[15px]">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="-ml-px block border-l-2 border-transparent py-2 pl-4 text-body no-underline hover:border-amber hover:text-ink">
                    {s.heading}
                  </a>
                </li>
              ))}
              {faqs.length ? (
                <li>
                  <a href="#faqs" className="-ml-px block border-l-2 border-transparent py-2 pl-4 text-body no-underline hover:border-amber hover:text-ink">
                    FAQs
                  </a>
                </li>
              ) : null}
            </ol>
          </nav>

          <article className="flex max-w-[70ch] min-w-0 flex-col gap-12">
            {sections.map((s) => (
              <Reveal as="section" key={s.id} className="flex scroll-mt-28 flex-col gap-4" >
                <h2 id={s.id} className="font-display m-0 scroll-mt-28 text-[34px] min-[760px]:text-[40px]">
                  {s.heading}
                </h2>
                {paragraphs(s.body).map((p) => (
                  <p key={p.slice(0, 30)} className="m-0 text-[17px] leading-[1.7] text-body">
                    {p}
                  </p>
                ))}
                {s.areas?.length ? (
                  <div className="grid grid-cols-1 gap-4 min-[560px]:grid-cols-2">
                    {s.areas
                      .filter((a) => a.name && a.body)
                      .map((a, i) => (
                        <Reveal key={a.name} delay={i * STAGGER} className="border-t-2 border-amber bg-paper p-5">
                          <h3 className="m-0 text-lg font-semibold">{a.name}</h3>
                          <p className="mt-2 mb-0 text-body">{a.body}</p>
                        </Reveal>
                      ))}
                  </div>
                ) : null}
                {s.id === "areas" ? (
                  <p className="m-0 text-body">
                    Planning to stay in Ijapo? Compare our <Link href="/rooms">rooms and suites in Akure</Link>, or{" "}
                    <Link href="/contact">ask the front office</Link> which part of town suits your trip.
                  </p>
                ) : null}
              </Reveal>
            ))}

            <Reveal className="flex flex-wrap items-center justify-between gap-6 bg-ink p-8 text-stone">
              <div>
                <p className="font-display m-0 text-[28px]">Stay at Selems in Ijapo Extension</p>
                <p className="mt-1 mb-0 text-[#C9D3D9]">
                  {rooms.length} room types{fromRate ? ` from ${fromRate} a night` : ""}. Reserve now, pay at the hotel.
                </p>
              </div>
              <Link href="/book" className={buttonVariants({ variant: "amber", size: "cta" })}>
                Check availability
              </Link>
            </Reveal>

            {faqs.length ? (
              <Reveal as="section" className="flex flex-col gap-4">
                <h2 id="faqs" className="font-display m-0 scroll-mt-28 text-[34px] min-[760px]:text-[40px]">
                  FAQs
                </h2>
                <Faq faqs={faqs} />
              </Reveal>
            ) : null}
          </article>
        </div>
      </section>

      <JsonLd
        data={articleJsonLd({
          headline: title,
          description: page?.seoDescription ?? intro,
          path: "/akure-guide",
          image: HERO,
          author: author || null,
          datePublished: isoDate(updated),
          dateModified: isoDate(updated),
          hotelName: settings.hotelName,
        })}
      />
    </>
  );
}
