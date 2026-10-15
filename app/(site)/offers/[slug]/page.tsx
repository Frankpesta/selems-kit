import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/site/blocks";
import { HeroImage, HeroRise } from "@/components/motion/HeroIntro";
import { Reveal } from "@/components/motion/Reveal";
import { getOffers } from "@/lib/data";
import { siteImage } from "@/lib/images";
import { formatNaira } from "@/lib/money";
import { arrivalText, validityText } from "@/lib/offers";
import { plural } from "@/lib/format";
import { pageMetadata } from "@/lib/seo";

const FALLBACK = "/images/selems-hotel-akure-suite-living-area.jpg";

export async function generateStaticParams() {
  const offers = await getOffers();
  return offers.length ? offers.map((o) => ({ slug: o.slug })) : [{ slug: "_" }];
}

async function load(slug: string) {
  return (await getOffers({ slug }))[0] ?? null;
}

export async function generateMetadata({ params }: PageProps<"/offers/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const o = await load(slug);
  if (!o) return { title: "This offer has ended | Selems Hotel, Akure", robots: { index: false, follow: true } };
  return pageMetadata({
    title: `${o.title}: ${plural(o.nights, "night")} for ${formatNaira(o.priceTotal)} | Selems Hotel, Akure`,
    description: `${o.summary} Selems Exclusive Hotel & Suites, Ijapo Extension, Akure. Book direct, pay at the hotel.`,
    path: `/offers/${o.slug}`,
    image: o.image ?? siteImage(FALLBACK),
  });
}

export default async function OfferPage({ params }: PageProps<"/offers/[slug]">) {
  const { slug } = await params;
  const o = await load(slug);

  if (!o) {
    return (
      <section className="py-24">
        <div className="container-site flex max-w-[720px] flex-col items-start gap-5">
          <h1 className="font-display text-page m-0">This offer has ended</h1>
          <p className="lede m-0">It may have expired or been replaced. Our rooms are still available at their nightly rates.</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/offers" className={buttonVariants({ variant: "line", size: "cta" })}>
              Current offers
            </Link>
            <Link href="/rooms" className={buttonVariants({ variant: "amber", size: "cta" })}>
              See rooms &amp; prices
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const img = o.image ?? siteImage(FALLBACK);
  const arrive = arrivalText(o.arrivalWeekdays);
  const room = o.rooms[0];
  const bookHref = `/book?offer=${o.slug}${room ? `&room=${room.slug}` : ""}`;

  return (
    <>
      <section className="overflow-hidden bg-velvet text-[#F1F3EF]">
        <div className="container-site grid grid-cols-1 items-center gap-12 pt-10 pb-16 min-[980px]:grid-cols-2 min-[980px]:pb-24">
          <div className="flex flex-col gap-6">
            <div className="[&_a]:text-[#DCE5DC] [&_nav]:text-[#CFDCCF]">
              <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Offers", path: "/offers" }, { name: o.title, path: `/offers/${o.slug}` }]} />
            </div>
            <HeroRise order={0}>
              <h1 className="font-display text-page m-0">{o.title}</h1>
            </HeroRise>
            <HeroRise order={1}>
              <p className="font-display m-0 text-[36px] tabular-nums">
                {formatNaira(o.priceTotal)} <span className="text-[22px] text-[#CFDCCF]">for {plural(o.nights, "night")}</span>
              </p>
            </HeroRise>
            <HeroRise order={2}>
              <p className="lede m-0 text-[#DCE5DC]">{o.summary}</p>
            </HeroRise>
            <HeroRise order={3}>
              <Link href={bookHref} className={buttonVariants({ variant: "amber", size: "cta" })}>
                Book this offer
              </Link>
            </HeroRise>
          </div>
          {img ? (
            <HeroImage className="aspect-[4/3]">
              <Image src={img.url} alt={img.alt} width={img.width} height={img.height} priority fetchPriority="high" sizes="(min-width: 980px) 620px, 100vw" className="h-full w-full object-cover" />
            </HeroImage>
          ) : null}
        </div>
      </section>

      <section className="py-[72px] min-[760px]:py-24">
        <div className="container-site grid max-w-[960px] grid-cols-1 gap-10">
          <Reveal>
            <h2 className="font-display m-0 text-[36px]">What&rsquo;s included</h2>
            <dl className="mt-6 mb-0">
              {(
                [
                  ["Room", o.rooms.length ? o.rooms.map((r) => r.name).join(", ") : null],
                  ["Length of stay", plural(o.nights, "night")],
                  ["Price", `${formatNaira(o.priceTotal)} in total, paid at the hotel`],
                  ["Arrival", arrive],
                  ["Dates", validityText(o.validFrom, o.validTo)],
                ] as [string, string | null][]
              )
                .filter((r): r is [string, string] => !!r[1])
                .map(([k, v]) => (
                  <div key={k} className="grid grid-cols-1 gap-1 border-t border-line py-3 min-[560px]:grid-cols-[200px_1fr] min-[560px]:gap-6">
                    <dt className="font-semibold">{k}</dt>
                    <dd className="m-0 text-body">{v}</dd>
                  </div>
                ))}
            </dl>
          </Reveal>
          {o.description ? (
            <Reveal>
              <p className="lede m-0">{o.description}</p>
            </Reveal>
          ) : null}
          {o.terms ? (
            <Reveal>
              <h2 className="font-display m-0 text-[28px]">Terms</h2>
              <p className="mt-3 mb-0 text-body">{o.terms}</p>
            </Reveal>
          ) : null}
          <Reveal className="flex flex-wrap gap-3">
            <Link href={bookHref} className={buttonVariants({ variant: "amber", size: "cta" })}>
              Book this offer
            </Link>
            {room ? (
              <Link href={`/rooms/${room.slug}`} className={buttonVariants({ variant: "line", size: "cta" })}>
                See the {room.name}
              </Link>
            ) : null}
          </Reveal>
        </div>
      </section>
    </>
  );
}
