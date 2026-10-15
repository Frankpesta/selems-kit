import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Breadcrumbs, SectionHeading } from "@/components/site/blocks";
import { Checklist } from "@/components/site/Checklist";
import { RoomsBrowser } from "@/components/site/RoomsBrowser";
import { JsonLd } from "@/components/seo/JsonLd";
import { HeroRise } from "@/components/motion/HeroIntro";
import { Reveal } from "@/components/motion/Reveal";
import { STAGGER } from "@/components/motion/tokens";
import { getFaqs, getPage, getRooms } from "@/lib/data";
import { formatNaira } from "@/lib/money";
import { itemListJsonLd, pageMetadata } from "@/lib/seo";
import { Faq } from "@/components/site/blocks";

const str = (v: unknown, fallback = "") => (typeof v === "string" && v.trim() ? v : fallback);

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("rooms");
  return pageMetadata({
    title: page?.seoTitle ?? "Rooms & Suites in Akure | Selems Hotel",
    description: page?.seoDescription ?? "",
    path: "/rooms",
  });
}

export default async function RoomsPage() {
  const [page, rooms, faqs] = await Promise.all([getPage("rooms"), getRooms(), getFaqs("rooms")]);
  const f = page?.fields ?? {};
  const inEveryRoom = Array.isArray(f.inEveryRoom) ? (f.inEveryRoom as string[]) : [];

  return (
    <>
      <section className="pt-10 pb-6 min-[760px]:pt-14">
        <div className="container-site flex flex-col gap-6">
          <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Rooms & suites", path: "/rooms" }]} />
          <div className="grid grid-cols-1 items-end gap-6 min-[760px]:grid-cols-2">
            <HeroRise order={0}>
              <h1 className="font-display text-page m-0">{str(f.h1, "Rooms and suites in Selems")}</h1>
            </HeroRise>
            <HeroRise order={1}>
              <p className="lede m-0">{str(f.lede)}</p>
            </HeroRise>
          </div>
        </div>
      </section>

      <section aria-label="All rooms" className="pt-2 pb-24">
        <div className="container-site">
          <RoomsBrowser rooms={rooms} />
        </div>
      </section>

      {inEveryRoom.length ? (
        <section aria-labelledby="every" className="bg-paper py-[72px] min-[760px]:py-28">
          <div className="container-site grid grid-cols-1 items-start gap-12 min-[760px]:grid-cols-2 min-[980px]:gap-16">
            <Reveal className="flex flex-col gap-4">
              <SectionHeading id="every" eyebrow="In every room" title="The standard, whichever rate you book" />
              <p className="lede m-0">
                Every room and suite in Akure is cleaned daily and comes with the same essentials, from the
                Standard Room to the Penthouse.
              </p>
            </Reveal>
            <Reveal delay={STAGGER}>
              <Checklist items={inEveryRoom} />
            </Reveal>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="compare" className="py-[72px] min-[760px]:py-28">
        <div className="container-site flex flex-col gap-8">
          <Reveal>
            <SectionHeading id="compare" eyebrow="At a glance" title="Compare rates" />
          </Reveal>
          <Reveal delay={STAGGER} className="min-w-0">
            <p className="mt-0 mb-2 text-xs text-muted-foreground min-[760px]:hidden">Swipe the table sideways to see every column.</p>
            <div className="max-w-full overflow-x-auto overscroll-x-contain border border-line bg-paper">
            <table className="w-full min-w-[720px] border-collapse text-[15px] tabular-nums">
              <caption className="sr-only">Room types, who they sleep and nightly rates in naira</caption>
              <thead>
                <tr className="text-left text-xs tracking-[0.12em] text-muted-foreground uppercase">
                  <th scope="col" className="px-5 py-4 font-semibold">Room</th>
                  <th scope="col" className="px-5 py-4 font-semibold">Type</th>
                  <th scope="col" className="px-5 py-4 font-semibold">Sleeps</th>
                  <th scope="col" className="px-5 py-4 font-semibold">Lounge</th>
                  <th scope="col" className="px-5 py-4 text-right font-semibold">Per night</th>
                  <th scope="col" className="px-5 py-4">
                    <span className="sr-only">Book</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((r) => (
                  <tr key={r.slug} className="border-t border-line transition-colors hover:bg-selected">
                    <th scope="row" className="px-5 py-4 text-left font-semibold">
                      <Link href={`/rooms/${r.slug}`} className="text-ink no-underline hover:text-amber">
                        {r.name}
                      </Link>
                    </th>
                    <td className="px-5 py-4">{r.category === "suite" ? "Suite" : "Room"}</td>
                    <td className="px-5 py-4">
                      {r.maxAdults} adult{r.maxAdults === 1 ? "" : "s"}
                      {r.maxChildren ? ` + ${r.maxChildren} child` : ""}
                    </td>
                    <td className="px-5 py-4">{r.hasLounge ? "Yes" : "–"}</td>
                    <td className="px-5 py-4 text-right font-semibold">{formatNaira(r.baseRate)}</td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/book?room=${r.slug}`} className="font-semibold">
                        Book<span className="sr-only"> the {r.name}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Reveal>
        </div>
      </section>

      {faqs.length ? (
        <section aria-labelledby="rooms-faq" className="bg-paper py-[72px] min-[760px]:py-28">
          <div className="container-site grid grid-cols-1 items-start gap-12 min-[760px]:grid-cols-2">
            <Reveal>
              <SectionHeading id="rooms-faq" eyebrow="Before you book" title="Questions about rooms" />
            </Reveal>
            <Reveal delay={STAGGER}>
              <Faq faqs={faqs} />
            </Reveal>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="groups" className="bg-ink text-stone">
        <div className="container-site flex flex-wrap items-center justify-between gap-6 py-[72px]">
          <Reveal>
            <h2 id="groups" className="font-display m-0 text-[36px] min-[760px]:text-[44px]">
              Booking for a group or an event?
            </h2>
            <p className="mt-3 mb-0 text-[#C9D3D9]">
              Weddings, burials, convocations and conferences: we&rsquo;ll hold several rooms for you.
            </p>
          </Reveal>
          <Reveal delay={STAGGER} className="flex flex-wrap gap-3">
            <Link href="/contact?subject=group" className={buttonVariants({ variant: "light", size: "cta" })}>
              Ask for a group rate
            </Link>
            <Link href="/book" className={buttonVariants({ variant: "amber", size: "cta" })}>
              Book online
            </Link>
          </Reveal>
        </div>
      </section>

      <JsonLd data={itemListJsonLd(rooms)} />
    </>
  );
}
