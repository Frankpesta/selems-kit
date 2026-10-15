import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs, Faq, SectionHeading } from "@/components/site/blocks";
import { JsonLd } from "@/components/seo/JsonLd";
import { HeroImage, HeroRise } from "@/components/motion/HeroIntro";
import { Parallax } from "@/components/motion/Parallax";
import { Reveal } from "@/components/motion/Reveal";
import { STAGGER } from "@/components/motion/tokens";
import { getFaqs, getPage, getSettings } from "@/lib/data";
import { arr, obj, str } from "@/lib/fields";
import { siteImage, siteImages } from "@/lib/images";
import { pageMetadata, restaurantJsonLd } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("dining");
  return pageMetadata({
    title: page?.seoTitle ?? "Restaurant & Bar in Akure | Selems Exclusive Hotel",
    description: page?.seoDescription ?? "",
    path: "/dining",
    image: siteImage("/images/selems-hotel-akure-restaurant-dining-room.jpg"),
  });
}

const section = "py-[72px] min-[760px]:py-28";

export default async function DiningPage() {
  const [page, settings, faqs] = await Promise.all([getPage("dining"), getSettings(), getFaqs("dining")]);
  const f = page?.fields ?? {};
  const hero = siteImage("/images/selems-hotel-akure-restaurant-dining-room.jpg");
  const hours = arr<{ label?: string; value?: string }>(f.hours).filter((h) => h.label && h.value);
  const menu = arr<{ name?: string; description?: string }>(f.menuCategories).filter((m) => m.name && m.description);
  const indoor = obj(f.indoorBar);
  const outdoor = obj(f.outdoorBar);
  const outdoorImage = siteImage(outdoor.image);
  const menuPdf = str(f.menuPdfUrl);
  const barPhotos = siteImages([
    "/images/selems-hotel-akure-indoor-bar.jpg",
    "/images/selems-hotel-akure-bar-counter.jpg",
    "/images/selems-hotel-akure-bar-wine-display.jpg",
  ]);

  return (
    <>
      {/* Split dark hero */}
      <section aria-labelledby="dining-h1" className="overflow-hidden bg-ink text-stone">
        <div className="container-site grid grid-cols-1 items-center gap-12 pt-10 pb-16 min-[980px]:grid-cols-2 min-[980px]:pt-14 min-[980px]:pb-24">
          <div className="flex flex-col gap-6">
            <div className="[&_a]:text-[#C9D3D9] [&_nav]:text-[#AEBBC3]">
              <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Dining & bars", path: "/dining" }]} />
            </div>
            <HeroRise order={0}>
              <h1 id="dining-h1" className="font-display text-page m-0">
                {str(f.h1, "Restaurant and bars at Selems, Akure")}
              </h1>
            </HeroRise>
            <HeroRise order={1}>
              <p className="lede m-0 text-[#C9D3D9]">{str(f.lede)}</p>
            </HeroRise>
            <HeroRise order={2} className="flex flex-wrap gap-3">
              <Link href="/contact?subject=reservation" className={buttonVariants({ variant: "amber", size: "cta" })}>
                Reserve a table
              </Link>
              {menuPdf ? (
                <a href={menuPdf} className={buttonVariants({ variant: "light", size: "cta" })}>
                  Download the menu (PDF)
                </a>
              ) : null}
            </HeroRise>
          </div>
          {hero ? (
            <HeroImage className="aspect-[4/3]">
              <Image
                src={hero.url}
                alt={hero.alt}
                width={hero.width}
                height={hero.height}
                priority
                fetchPriority="high"
                sizes="(min-width: 980px) 640px, 100vw"
                className="h-full w-full object-cover"
              />
            </HeroImage>
          ) : null}
        </div>
      </section>

      {/* Restaurant */}
      <section aria-labelledby="restaurant" className={section}>
        <div className="container-site grid grid-cols-1 items-start gap-12 min-[980px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] min-[980px]:gap-16">
          <Reveal className="flex flex-col gap-6">
            <SectionHeading id="restaurant" eyebrow="The restaurant" title="Local favourites, continental plates" />
            {hours.length ? (
              <dl className="m-0">
                {hours.map((h) => (
                  <div key={h.label} className="flex justify-between gap-4 border-t border-line-strong py-3.5 last:border-b">
                    <dt>{h.label}</dt>
                    <dd className="m-0 font-semibold tabular-nums">{h.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <p className="m-0 text-body">
              Open to hotel guests and visitors. For a table for a group, call the front office or{" "}
              <Link href="/contact?subject=reservation">send us a message</Link>.
            </p>
          </Reveal>
          {menu.length ? (
            <div className="grid grid-cols-1 gap-6 min-[560px]:grid-cols-2">
              {menu.map((m, i) => (
                <Reveal key={m.name} delay={i * STAGGER} className="border-t-2 border-amber bg-paper p-6">
                  <h3 className="font-display m-0 text-[28px]">{m.name}</h3>
                  <p className="mt-2 mb-0 text-body">{m.description}</p>
                </Reveal>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* Indoor bar */}
      {str(indoor.heading) ? (
        <section aria-labelledby="indoor" className={`${section} bg-paper`}>
          <div className="container-site grid grid-cols-1 items-center gap-12 min-[980px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] min-[980px]:gap-16">
            <div className="grid grid-cols-2 grid-rows-[220px_180px] gap-3 min-[760px]:grid-rows-[300px_240px]">
              {barPhotos.map((img, i) => (
                <Reveal key={img.url} delay={i * STAGGER} y={36} className={i === 0 ? "row-span-2" : undefined}>
                  <Parallax className="h-full" strength={i === 0 ? 0.06 : 0.04}>
                    <Image
                      src={img.url}
                      alt={img.alt}
                      width={img.width}
                      height={img.height}
                      sizes={i === 0 ? "(min-width: 980px) 600px, 90vw" : "(min-width: 980px) 420px, 60vw"}
                      className="h-full w-full object-cover"
                    />
                  </Parallax>
                </Reveal>
              ))}
            </div>
            <Reveal className="flex flex-col gap-5">
              <SectionHeading id="indoor" eyebrow="Indoor bar & lounge" title={str(indoor.heading)} />
              <p className="lede m-0">{str(indoor.body)}</p>
              {str(indoor.hours) ? (
                <p className="m-0">
                  <span className="font-semibold">Open:</span> {str(indoor.hours)}
                </p>
              ) : null}
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* Outdoor bar: published only once the hotel confirms it (and a photo exists) */}
      {str(outdoor.heading) && str(outdoor.body) && outdoorImage ? (
        <section aria-labelledby="outdoor" className={section}>
          <div className="container-site grid grid-cols-1 items-center gap-12 min-[980px]:grid-cols-2">
            <Reveal className="flex flex-col gap-5">
              <SectionHeading id="outdoor" eyebrow="Outdoor bar" title={str(outdoor.heading)} />
              <p className="lede m-0">{str(outdoor.body)}</p>
            </Reveal>
            <Reveal delay={STAGGER}>
              <Parallax className="aspect-[4/3]">
                <Image src={outdoorImage.url} alt={outdoorImage.alt} width={outdoorImage.width} height={outdoorImage.height} sizes="(min-width: 980px) 620px, 100vw" className="h-full w-full object-cover" />
              </Parallax>
            </Reveal>
          </div>
        </section>
      ) : null}

      {faqs.length ? (
        <section aria-labelledby="dining-faq" className={section}>
          <div className="container-site grid grid-cols-1 items-start gap-12 min-[760px]:grid-cols-2">
            <Reveal>
              <SectionHeading id="dining-faq" eyebrow="Good to know" title="Food and drink questions" />
            </Reveal>
            <Reveal delay={STAGGER}>
              <Faq faqs={faqs} />
            </Reveal>
          </div>
        </section>
      ) : null}

      {/* Private dining CTA */}
      <section aria-labelledby="private" className="bg-velvet text-[#F1F3EF]">
        <div className="container-site flex flex-wrap items-center justify-between gap-6 py-[72px]">
          <Reveal className="max-w-[640px]">
            <h2 id="private" className="font-display m-0 text-[36px] min-[760px]:text-[44px]">
              Hosting a dinner, a family gathering or a small event?
            </h2>
            <p className="mt-3 mb-0 text-[#DCE5DC]">
              Tell us the date and how many guests, and we&rsquo;ll plan the food and drinks with you.
            </p>
          </Reveal>
          <Reveal delay={STAGGER}>
            <Link href="/contact?subject=group" className={buttonVariants({ variant: "amber", size: "cta" })}>
              Plan a private meal
            </Link>
          </Reveal>
        </div>
      </section>

      <JsonLd data={restaurantJsonLd(settings, { image: hero?.url, menu: menu.map((m) => ({ name: m.name!, description: m.description })) })} />
    </>
  );
}
