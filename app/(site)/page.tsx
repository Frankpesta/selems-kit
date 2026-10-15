import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { AvailabilityBar } from "@/components/site/AvailabilityBar";
import { MapPanel } from "@/components/site/MapPanel";
import { AmenityRow, Faq, RoomCard, SectionHeading } from "@/components/site/blocks";
import { CountUp } from "@/components/motion/CountUp";
import { HeroImage, HeroRise } from "@/components/motion/HeroIntro";
import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { STAGGER } from "@/components/motion/tokens";
import { getFacilities, getFaqs, getOffers, getPage, getReviews, getRooms, getSettings } from "@/lib/data";
import { addressLine, fill, mapsEmbedSrc, mapsHref } from "@/lib/contact";
import { formatNaira } from "@/lib/money";
import { siteImage, siteImages } from "@/lib/images";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

const str = (v: unknown, fallback = "") => (typeof v === "string" && v.trim() ? v : fallback);

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("home");
  return pageMetadata({
    title: page?.seoTitle ?? "Hotel in Akure | Selems Exclusive Hotel & Suites",
    description: page?.seoDescription ?? "",
    path: "/",
    image: siteImage("/images/selems-hotel-akure-exterior-front.jpg"),
  });
}

const section = "py-[72px] min-[760px]:py-28";

export default async function HomePage() {
  const [page, rooms, settings, offers, facilities, reviews, faqs] = await Promise.all([
    getPage("home"),
    getRooms(),
    getSettings(),
    getOffers({ showOnHome: true }),
    getFacilities(),
    getReviews(),
    getFaqs("home"),
  ]);
  const f = page?.fields ?? {};
  const fromRate = rooms.length ? Math.min(...rooms.map((r) => r.fromRate)) : null;
  const vars = { fromRate: fromRate !== null ? formatNaira(fromRate) : "" };
  const hero = siteImages(f.heroImages).slice(0, 3);
  const featured = rooms.filter((r) => r.featured).slice(0, 3);
  const offer = offers[0];
  const offerImage = offer?.image ?? siteImage("/images/selems-hotel-akure-suite-living-area.jpg");
  const diningImages = siteImages([
    "/images/selems-hotel-akure-restaurant-dining-room.jpg",
    "/images/selems-hotel-akure-bar-wine-display.jpg",
  ]);
  const exterior = siteImage("/images/selems-hotel-akure-exterior-front.jpg");
  const distances = (Array.isArray(f.distances) ? f.distances : []).filter(
    (d): d is { place: string; value: string } => !!d?.place && !!d?.value,
  );
  const address = addressLine(settings.address);
  const facts = [
    { value: String(rooms.length), label: "room and suite types", count: true },
    { value: "24/7", label: "front office and room service", count: false },
    { value: "2", label: "bars, indoor and outdoor", count: true },
    ...(fromRate !== null
      ? [{ value: `₦${Math.round(fromRate / 100_000)}k`, label: "nightly rates start from", count: true }]
      : []),
  ];

  return (
    <>
      {/* 1. Hero */}
      <section aria-labelledby="home-h1" className="overflow-hidden bg-ink text-stone">
        <div className="container-site grid grid-cols-1 items-end gap-14 pt-12 pb-[104px] min-[980px]:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] min-[980px]:pt-[72px] min-[980px]:pb-[120px]">
          <div className="flex flex-col gap-7">
            <HeroRise order={0}>
              <p className="eyebrow m-0 text-amber-tint">{str(f.eyebrow, "Ijapo Extension · Akure, Ondo State")}</p>
            </HeroRise>
            <HeroRise order={1}>
              <h1 id="home-h1" className="font-display text-hero m-0">
                {str(f.h1, "A hotel and suites in Akure, kept to an international standard.")}
              </h1>
            </HeroRise>
            <HeroRise order={2}>
              <p className="lede m-0 text-[#C9D3D9]">{fill(str(f.lede), vars)}</p>
            </HeroRise>
            <HeroRise order={3} className="flex flex-wrap gap-3">
              <Link href="/book" className={buttonVariants({ variant: "amber", size: "cta" })}>
                Check availability
              </Link>
              <Link href="/rooms" className={buttonVariants({ variant: "light", size: "cta" })}>
                See rooms &amp; prices
              </Link>
            </HeroRise>
          </div>
          {hero.length ? (
            <div className="grid grid-cols-2 grid-rows-[200px_160px] gap-3 min-[560px]:grid-rows-[260px_220px]">
              {hero.map((img, i) => (
                <HeroImage key={img.url} order={i} className={i === 0 ? "row-span-2" : undefined}>
                  <Image
                    src={img.url}
                    alt={img.alt}
                    width={img.width}
                    height={img.height}
                    priority={i === 0}
                    fetchPriority={i === 0 ? "high" : undefined}
                    // Tall frames crop landscape photos, so they need ~1.5–2× the frame width.
                    sizes={i === 0 ? "(min-width: 980px) 720px, 110vw" : "(min-width: 980px) 400px, 75vw"}
                    className="h-full w-full object-cover"
                  />
                </HeroImage>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* 2. Availability bar, overlapping the hero */}
      <div className="container-site">
        <HeroRise order={4}>
          <AvailabilityBar className="-mt-16" />
        </HeroRise>
      </div>

      {/* 3. About + facts */}
      <section aria-labelledby="about" className={section}>
        <div className="container-site flex flex-col gap-14">
          <div className="grid grid-cols-1 items-end gap-8 min-[760px]:grid-cols-2">
            <Reveal>
              <SectionHeading id="about" eyebrow="About the hotel" title={str(f.aboutHeading, "About Selems")} />
            </Reveal>
            <Reveal delay={STAGGER}>
              <p className="lede m-0">{str(f.aboutBody)}</p>
            </Reveal>
          </div>
          <dl className="m-0 grid grid-cols-2 border-y border-line-strong min-[980px]:grid-cols-4">
            {facts.map((x, i) => (
              <Reveal
                key={x.label}
                delay={i * STAGGER}
                y={18}
                className={cn(
                  "flex flex-col-reverse px-6 py-7",
                  i % 2 === 1 && "border-l border-line-strong",
                  i >= 2 && "border-t border-line-strong min-[980px]:border-t-0",
                  i === 2 && "min-[980px]:border-l",
                )}
              >
                <dt className="mt-1 text-body">{x.label}</dt>
                <dd className="font-display m-0 text-[36px] tabular-nums min-[760px]:text-[48px]">
                  {x.count ? <CountUp value={x.value} /> : x.value}
                </dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      {/* 4. Featured rooms */}
      {featured.length ? (
        <section aria-labelledby="rooms" className={cn(section, "bg-paper")}>
          <div className="container-site flex flex-col gap-12">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <Reveal>
                <SectionHeading id="rooms" eyebrow="Rooms & suites" title="Where you will sleep" />
              </Reveal>
              <Reveal delay={STAGGER}>
                <Link href="/rooms" className={buttonVariants({ variant: "line", size: "cta" })}>
                  Compare all {rooms.length} rooms
                </Link>
              </Reveal>
            </div>
            <div className="grid grid-cols-1 gap-x-6 gap-y-12 min-[760px]:grid-cols-3">
              {featured.map((r, i) => (
                <Reveal key={r.slug} delay={i * STAGGER * 1.5} className="flex">
                  <RoomCard room={r} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 5. Offer band */}
      {offer ? (
        <section aria-labelledby="offer" className="overflow-hidden bg-velvet text-[#F1F3EF]">
          <div className="container-site grid grid-cols-1 items-center gap-10 py-[72px] min-[760px]:grid-cols-2 min-[760px]:py-[88px]">
            <Reveal className="flex flex-col gap-5">
              <p className="eyebrow m-0 text-[#CFDCCF]">Current offer</p>
              <h2 id="offer" className="font-display m-0 text-[36px] min-[760px]:text-[56px]">
                {offer.title}: {offer.nights} nights for {formatNaira(offer.priceTotal)}
              </h2>
              <p className="lede m-0 text-[#DCE5DC]">{offer.summary}</p>
              {offer.terms ? <p className="m-0 text-sm text-[#CFDCCF]">{offer.terms}</p> : null}
              <div>
                <Link
                  href={`/book?offer=${offer.slug}${offer.rooms[0] ? `&room=${offer.rooms[0].slug}` : ""}`}
                  className={buttonVariants({ variant: "amber", size: "cta" })}
                >
                  Book the offer
                </Link>
              </div>
            </Reveal>
            {offerImage ? (
              <Reveal delay={STAGGER * 2}>
                <Parallax className="aspect-[4/3]">
                  <Image
                    src={offerImage.url}
                    alt={offerImage.alt}
                    width={offerImage.width}
                    height={offerImage.height}
                    sizes="(min-width: 1240px) 760px, (min-width: 760px) 60vw, 120vw"
                    className="h-full w-full object-cover"
                  />
                </Parallax>
              </Reveal>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* 6. Dining split */}
      <section aria-labelledby="dine" className={section}>
        <div className="container-site grid grid-cols-1 items-center gap-12 min-[760px]:grid-cols-2 min-[980px]:gap-16">
          <div className="grid grid-cols-2 gap-3">
            {diningImages.map((img, i) => (
              <Reveal key={img.url} delay={i * STAGGER * 2} y={40} className={i === 1 ? "mt-14" : undefined}>
                <Parallax className="h-[280px] min-[760px]:h-[420px]" strength={i === 1 ? 0.1 : 0.05}>
                  <Image
                    src={img.url}
                    alt={img.alt}
                    width={img.width}
                    height={img.height}
                    sizes="(min-width: 760px) 720px, 110vw"
                    className="h-full w-full object-cover"
                  />
                </Parallax>
              </Reveal>
            ))}
          </div>
          <Reveal className="flex flex-col gap-5">
            <SectionHeading id="dine" eyebrow="Dining & bars" title={str(f.diningHeading, "Dining and bars")} />
            <p className="lede m-0">{str(f.diningBody)}</p>
            <div>
              <Link href="/dining" className={buttonVariants({ variant: "line", size: "cta" })}>
                Restaurant &amp; bars in Akure
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 7. Included with every stay */}
      {facilities.length ? (
        <section aria-labelledby="fac" className={cn(section, "bg-paper")}>
          <div className="container-site flex flex-col gap-10">
            <Reveal>
              <SectionHeading id="fac" eyebrow="Facilities" title="Included with every stay" />
            </Reveal>
            <div className="grid grid-cols-1 gap-x-6 min-[760px]:grid-cols-3">
              {facilities.slice(0, 6).map((x, i) => (
                <Reveal key={x.title} delay={(i % 3) * STAGGER + Math.floor(i / 3) * STAGGER} y={20}>
                  <AmenityRow icon={x.icon} title={x.title} body={x.body} />
                </Reveal>
              ))}
            </div>
            <Reveal>
              <Link href="/facilities" className="font-semibold">
                All hotel facilities
              </Link>
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* 8. Location */}
      <section aria-labelledby="loc" className={section}>
        <div className="container-site grid grid-cols-1 items-start gap-14 min-[760px]:grid-cols-2">
          <Reveal className="flex flex-col gap-5">
            <SectionHeading id="loc" eyebrow="Location" title={str(f.locationHeading, address)} />
            <address className="m-0 font-semibold not-italic">{address}</address>
            <p className="lede m-0">{str(f.locationBody)}</p>
            {distances.length ? (
              <ul className="m-0 flex list-none flex-col p-0">
                {distances.map((d) => (
                  <li key={d.place} className="flex justify-between gap-4 border-t border-line-strong py-3.5 last:border-b">
                    <span>{d.place}</span>
                    <span className="tabular-nums">{d.value}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap gap-3">
              <a
                href={mapsHref(settings.hotelName, settings.address, settings.geo)}
                target="_blank"
                rel="noopener"
                className={buttonVariants({ variant: "line", size: "cta" })}
              >
                Get directions
              </a>
              <Link href="/contact" className={buttonVariants({ variant: "line", size: "cta" })}>
                Contact the hotel
              </Link>
            </div>
          </Reveal>
          <div className="flex flex-col gap-3">
            {exterior ? (
              <Reveal delay={STAGGER}>
                <Parallax className="aspect-video" strength={0.06}>
                  <Image
                    src={exterior.url}
                    alt={exterior.alt}
                    width={exterior.width}
                    height={exterior.height}
                    sizes="(min-width: 1240px) 760px, (min-width: 760px) 60vw, 120vw"
                    className="h-full w-full object-cover"
                  />
                </Parallax>
              </Reveal>
            ) : null}
            <Reveal delay={STAGGER * 2}>
              <MapPanel
                embedSrc={mapsEmbedSrc(settings.hotelName, settings.address, settings.geo, settings.mapEmbedUrl)}
                mapsHref={mapsHref(settings.hotelName, settings.address, settings.geo)}
                address={address}
              />
            </Reveal>
          </div>
        </div>
      </section>

      {/* 9. Reviews: hidden entirely until there are approved, featured reviews */}
      {reviews.length ? (
        <section aria-labelledby="rev" className={cn(section, "bg-paper")}>
          <div className="container-site flex flex-col gap-10">
            <Reveal>
              <SectionHeading id="rev" eyebrow="Guest reviews" title="What guests say" />
            </Reveal>
            <div className="grid grid-cols-1 gap-6 min-[760px]:grid-cols-3">
              {reviews.slice(0, 3).map((r, i) => (
                <Reveal key={r.authorName + r.body.slice(0, 20)} delay={i * STAGGER} as="figure" className="m-0 flex flex-col gap-4 border-t border-line-strong pt-6">
                  <p className="m-0 text-amber" aria-label={`${r.rating} out of 5`}>
                    {"★".repeat(Math.round(r.rating))}
                  </p>
                  {r.title ? <p className="m-0 font-semibold">{r.title}</p> : null}
                  <blockquote className="m-0 text-body">{r.body}</blockquote>
                  <figcaption className="text-sm text-muted-foreground">
                    {r.authorName}
                    {r.stayMonth ? ` · ${r.stayMonth}` : ""}
                  </figcaption>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 10. FAQ */}
      {faqs.length ? (
        <section aria-labelledby="faq" className={section}>
          <div className="container-site grid grid-cols-1 items-start gap-16 min-[760px]:grid-cols-2">
            <Reveal className="flex flex-col gap-4">
              <SectionHeading id="faq" eyebrow="Before you book" title="Questions guests ask" />
              <p className="lede m-0">
                Anything else? Call or WhatsApp the front office: someone is on duty 24 hours a day.
              </p>
            </Reveal>
            <Reveal delay={STAGGER}>
              <Faq faqs={faqs} />
            </Reveal>
          </div>
        </section>
      ) : null}
    </>
  );
}
