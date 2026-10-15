import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { PageIntro } from "@/components/site/PageIntro";
import { Reveal } from "@/components/motion/Reveal";
import { STAGGER } from "@/components/motion/tokens";
import { getOffers } from "@/lib/data";
import { siteImage } from "@/lib/images";
import { formatNaira } from "@/lib/money";
import { arrivalText, validityText } from "@/lib/offers";
import { plural } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Hotel offers in Akure | Selems Exclusive Hotel & Suites",
  description: "Current room offers and packages at Selems Exclusive Hotel & Suites in Ijapo Extension, Akure. Book direct and pay at the hotel.",
  path: "/offers",
});

const FALLBACK = "/images/selems-hotel-akure-suite-living-area.jpg";

export default async function OffersPage() {
  const offers = await getOffers();
  return (
    <>
      <PageIntro
        crumbs={[{ name: "Offers", path: "/offers" }]}
        title="Offers at Selems, Akure"
        lede="Packages for stays in Ijapo Extension, Akure. Book direct on this site and pay at the hotel when you arrive."
      />
      <section aria-label="Current offers" className="pb-24">
        <div className="container-site">
          {offers.length === 0 ? (
            <Reveal className="flex flex-col items-start gap-5 border border-line bg-paper p-8">
              <h2 className="font-display m-0 text-[32px]">No offers running right now</h2>
              <p className="m-0 text-body">Our nightly rates are always shown in full. Check back soon, or see the rooms.</p>
              <Link href="/rooms" className={buttonVariants({ variant: "amber", size: "cta" })}>
                See rooms &amp; prices
              </Link>
            </Reveal>
          ) : (
            <ul className="m-0 grid list-none grid-cols-1 gap-8 p-0 min-[760px]:grid-cols-2">
              {offers.map((o, i) => {
                const img = o.image ?? siteImage(FALLBACK);
                const arrive = arrivalText(o.arrivalWeekdays);
                return (
                  <Reveal as="li" key={o.slug} delay={i * STAGGER}>
                    <article className="group flex h-full flex-col border border-line bg-paper">
                      {img ? (
                        <Link href={`/offers/${o.slug}`} tabIndex={-1} aria-hidden="true" className="block overflow-hidden">
                          <Image src={img.url} alt={img.alt} width={img.width} height={img.height} sizes="(min-width: 760px) 620px, 100vw" className="aspect-[16/9] w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]" />
                        </Link>
                      ) : null}
                      <div className="flex flex-1 flex-col gap-3 p-6">
                        <h2 className="font-display m-0 text-[32px]">
                          <Link href={`/offers/${o.slug}`} className="text-ink no-underline hover:text-amber">
                            {o.title}
                          </Link>
                        </h2>
                        <p className="m-0 text-lg font-semibold tabular-nums">
                          {formatNaira(o.priceTotal)} for {plural(o.nights, "night")}
                        </p>
                        <p className="m-0 text-body">{o.summary}</p>
                        <p className="m-0 text-sm text-muted-foreground">
                          {[arrive, validityText(o.validFrom, o.validTo)].filter(Boolean).join(" · ")}
                        </p>
                        <div className="mt-auto pt-2">
                          <Link href={`/offers/${o.slug}`} className={buttonVariants({ variant: "line", size: "cta-sm" })}>
                            Offer details<span className="sr-only">: {o.title}</span>
                          </Link>
                        </div>
                      </div>
                    </article>
                  </Reveal>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
