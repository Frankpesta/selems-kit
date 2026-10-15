import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { GalleryBrowser } from "@/components/site/GalleryBrowser";
import { PageIntro } from "@/components/site/PageIntro";
import { Reveal } from "@/components/motion/Reveal";
import { getGallery, getPage } from "@/lib/data";
import { str } from "@/lib/fields";
import { siteImage } from "@/lib/images";
import { pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("gallery");
  return pageMetadata({
    title: page?.seoTitle ?? "Photos | Selems Exclusive Hotel & Suites, Akure",
    description: page?.seoDescription ?? "",
    path: "/gallery", // filter URLs (?c=…) canonicalise here
    image: siteImage("/images/selems-hotel-akure-corridor-chandelier.jpg"),
  });
}

export default async function GalleryPage() {
  const [page, gallery] = await Promise.all([getPage("gallery"), getGallery()]);
  const f = page?.fields ?? {};
  return (
    <>
      <PageIntro
        crumbs={[{ name: "Gallery", path: "/gallery" }]}
        title={str(f.h1, "Photos of Selems Hotel, Akure")}
        lede={`${str(f.lede, "Real photographs of our rooms, suites, restaurant and bar.")} Tap any photo to see it full screen.`}
        className="pb-6 min-[760px]:pb-8"
      />
      <section aria-label="Photos" className="pb-24">
        <div className="container-site">
          <GalleryBrowser items={gallery} />
        </div>
      </section>
      <section aria-labelledby="gallery-cta" className="bg-ink text-stone">
        <div className="container-site flex flex-wrap items-center justify-between gap-6 py-[72px]">
          <Reveal>
            <h2 id="gallery-cta" className="font-display m-0 text-[36px] min-[760px]:text-[44px]">
              Like what you see?
            </h2>
          </Reveal>
          <Reveal className="flex flex-wrap gap-3">
            <Link href="/rooms" className={buttonVariants({ variant: "light", size: "cta" })}>
              Compare rooms
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
