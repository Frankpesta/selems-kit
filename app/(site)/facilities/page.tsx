import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AmenityIcon, SectionHeading } from "@/components/site/blocks";
import { PageIntro } from "@/components/site/PageIntro";
import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { STAGGER } from "@/components/motion/tokens";
import { getFacilities, getPage } from "@/lib/data";
import { str } from "@/lib/fields";
import { siteImage } from "@/lib/images";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("facilities");
  return pageMetadata({
    title: page?.seoTitle ?? "Hotel Facilities | Selems Exclusive Hotel, Akure",
    description: page?.seoDescription ?? "",
    path: "/facilities",
    image: siteImage("/images/selems-hotel-akure-front-desk-reception.jpg"),
  });
}

const LINKS: Record<string, { href: string; label: string }> = {
  "24/7 room service": { href: "/dining", label: "Restaurant and bars" },
  Restaurant: { href: "/dining", label: "See the restaurant" },
  "Indoor and outdoor bars": { href: "/dining", label: "Bars at Selems" },
  "Smart TVs": { href: "/rooms", label: "Rooms and suites in Akure" },
};

export default async function FacilitiesPage() {
  const [page, facilities] = await Promise.all([getPage("facilities"), getFacilities()]);
  const f = page?.fields ?? {};
  const featured = facilities.filter((x) => x.image);
  const more = facilities.filter((x) => !x.image);

  return (
    <>
      <PageIntro
        crumbs={[{ name: "Facilities", path: "/facilities" }]}
        title={str(f.h1, "Hotel facilities and services")}
        lede={str(f.lede)}
      />

      <div className="flex flex-col">
        {featured.map((x, i) => (
          <section
            key={x.title}
            aria-labelledby={`fac-${i}`}
            className={cn("py-14 min-[760px]:py-20", i % 2 === 0 ? "bg-paper" : "bg-stone")}
          >
            <div className="container-site grid grid-cols-1 items-center gap-10 min-[760px]:grid-cols-2 min-[980px]:gap-16">
              <Reveal y={36} className={cn(i % 2 === 1 && "min-[760px]:order-2")}>
                <Parallax className="aspect-[4/3]" strength={0.05}>
                  <Image
                    src={x.image!.url}
                    alt={x.image!.alt}
                    width={x.image!.width}
                    height={x.image!.height}
                    priority={i === 0}
                    sizes="(min-width: 1240px) 640px, (min-width: 760px) 55vw, 115vw"
                    className="h-full w-full object-cover"
                  />
                </Parallax>
              </Reveal>
              <Reveal delay={STAGGER} className="flex flex-col gap-4">
                <AmenityIcon name={x.icon} className="size-9" />
                {x.eyebrow ? <p className="eyebrow m-0">{x.eyebrow}</p> : null}
                <h2 id={`fac-${i}`} className="font-display m-0 text-[36px] min-[760px]:text-[44px]">
                  {x.title}
                </h2>
                <p className="lede m-0">{x.body}</p>
                {LINKS[x.title] ? (
                  <Link href={LINKS[x.title].href} className="font-semibold">
                    {LINKS[x.title].label}
                  </Link>
                ) : null}
              </Reveal>
            </div>
          </section>
        ))}
      </div>

      {more.length ? (
        <section aria-labelledby="more" className="py-[72px] min-[760px]:py-28">
          <div className="container-site flex flex-col gap-10">
            <Reveal>
              <SectionHeading id="more" eyebrow="Also on hand" title="Practical details" />
            </Reveal>
            <div className="grid grid-cols-1 gap-6 min-[560px]:grid-cols-2 min-[980px]:grid-cols-3">
              {more.map((x, i) => (
                <Reveal key={x.title} delay={(i % 3) * STAGGER} className="flex flex-col gap-3 border-t-2 border-amber bg-paper p-6">
                  <AmenityIcon name={x.icon} />
                  <h3 className="m-0 text-lg font-semibold">{x.title}</h3>
                  <p className="m-0 text-body">{x.body}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="fac-cta" className="bg-ink text-stone">
        <div className="container-site flex flex-wrap items-center justify-between gap-6 py-[72px]">
          <Reveal>
            <h2 id="fac-cta" className="font-display m-0 text-[36px] min-[760px]:text-[44px]">
              Everything here comes with every room.
            </h2>
          </Reveal>
          <Reveal delay={STAGGER} className="flex flex-wrap gap-3">
            <Link href="/rooms" className={buttonVariants({ variant: "light", size: "cta" })}>
              See rooms &amp; prices
            </Link>
            <Link href="/book" className={buttonVariants({ variant: "amber", size: "cta" })}>
              Book a room
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  );
}
