import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Breadcrumbs, Tag } from "@/components/site/blocks";
import { Checklist } from "@/components/site/Checklist";
import { RoomBookingCard } from "@/components/site/RoomBookingCard";
import { RoomCard } from "@/components/site/RoomCard";
import { RoomGallery } from "@/components/site/RoomGallery";
import { RoomMobileBar } from "@/components/site/RoomMobileBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { HeroRise } from "@/components/motion/HeroIntro";
import { Reveal } from "@/components/motion/Reveal";
import { STAGGER } from "@/components/motion/tokens";
import { getRoom, getRooms, getSettings } from "@/lib/data";
import { displayPhone, mainPhone, telHref, whatsappHref, whatsappPhone } from "@/lib/contact";
import { formatTime } from "@/lib/format";
import { formatNaira } from "@/lib/money";
import { pageMetadata, roomJsonLd } from "@/lib/seo";

export async function generateStaticParams() {
  const rooms = await getRooms();
  return rooms.map((r) => ({ slug: r.slug }));
}

async function load(slug: string) {
  const data = await getRoom(slug);
  if (data && "redirectTo" in data) permanentRedirect(`/rooms/${data.redirectTo}`);
  if (!data) notFound();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/rooms/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { room } = await load(slug);
  return pageMetadata({
    title: room.seoTitle ?? `${room.name} in Akure — ${formatNaira(room.baseRate)}/night | Selems Hotel`,
    description:
      room.seoDescription ??
      `${room.shortDescription} Free Wi-Fi, smart TV, 24/7 room service. Reserve now, pay at the hotel.`,
    path: `/rooms/${room.slug}`,
    // Share image comes from ./opengraph-image.tsx (photo + name + price in brand type).
  });
}

export default async function RoomPage({ params }: PageProps<"/rooms/[slug]">) {
  const { slug } = await params;
  const [{ room, others }, settings] = await Promise.all([load(slug), getSettings()]);
  const kind = room.category === "suite" ? "suite" : "room";
  const main = mainPhone(settings.phones);
  const wa = whatsappPhone(settings.phones);

  const goodToKnow: [string, string | null][] = [
    ["Check-in", settings.checkInTime ? `From ${formatTime(settings.checkInTime)}` : null],
    ["Check-out", settings.checkOutTime ? `By ${formatTime(settings.checkOutTime)}` : null],
    ["Front office", "Open 24 hours, so late arrivals are welcome"],
    ["Payment", "Nothing to pay now. Pay at the hotel by cash, transfer or card"],
    ["Cancellation", settings.cancellationPolicy],
    ["Children and extra guests", settings.childrenPolicy],
    ["Parking", "Free, in the hotel's gated forecourt"],
    ["Taxes", settings.taxNote],
  ];
  const facts = room.facts.filter((f) => f !== "Suite").concat(room.sizeSqm ? [`${room.sizeSqm} m²`] : []);

  return (
    <>
      <div className="container-site flex flex-col gap-6 pt-8 pb-6">
        <Breadcrumbs
          items={[
            { name: "Home", path: "/" },
            { name: "Rooms & suites", path: "/rooms" },
            { name: room.name, path: `/rooms/${room.slug}` },
          ]}
        />
        <HeroRise order={0}>
          <RoomGallery images={room.images} name={room.name} />
        </HeroRise>
      </div>

      <div className="container-site grid grid-cols-1 items-start gap-12 pt-6 pb-24 min-[980px]:grid-cols-[minmax(0,1fr)_400px] min-[980px]:gap-16">
        <div className="flex min-w-0 flex-col gap-10">
          <div className="flex flex-col gap-4">
            <HeroRise order={1} className="self-start">
              <Tag>{room.category === "suite" ? "Suite" : "Room"}</Tag>
            </HeroRise>
            <HeroRise order={2}>
              <h1 className="font-display text-page m-0">{room.name}</h1>
            </HeroRise>
            <HeroRise order={3}>
              <p className="m-0 flex flex-wrap gap-x-5 gap-y-1 text-muted-foreground">
                {facts.map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </p>
            </HeroRise>
            <HeroRise order={4}>
              <p className="lede m-0">{room.description}</p>
            </HeroRise>
          </div>

          <hr className="m-0 border-line" />
          <Reveal className="flex flex-col gap-5">
            <h2 className="font-display m-0 text-[32px]">In the {kind}</h2>
            <Checklist items={room.amenities} />
          </Reveal>

          <hr className="m-0 border-line" />
          <Reveal className="flex flex-col gap-4">
            <h2 className="font-display m-0 text-[32px]">Good to know</h2>
            <dl className="m-0">
              {goodToKnow
                .filter((row): row is [string, string] => !!row[1])
                .map(([label, value]) => (
                  <div key={label} className="grid grid-cols-1 gap-1 border-t border-line py-3 min-[560px]:grid-cols-[200px_1fr] min-[560px]:gap-6">
                    <dt className="font-semibold">{label}</dt>
                    <dd className="m-0 text-body">{value}</dd>
                  </div>
                ))}
            </dl>
          </Reveal>

          {others.length ? (
            <>
              <hr className="m-0 border-line" />
              <section aria-labelledby="others" className="flex flex-col gap-6">
                <Reveal className="flex flex-wrap items-end justify-between gap-4">
                  <h2 id="others" className="font-display m-0 text-[32px]">
                    {others[0].category === room.category ? `Other ${kind === "suite" ? "suites" : "rooms"}` : "Other rooms"} in Akure
                  </h2>
                  <Link href="/rooms" className="font-semibold">
                    All rooms and suites
                  </Link>
                </Reveal>
                <div className="grid grid-cols-1 gap-x-6 gap-y-10 min-[560px]:grid-cols-2 min-[1240px]:grid-cols-3">
                  {others.map((o, i) => (
                    <Reveal key={o.slug} delay={i * STAGGER} className="flex">
                      <RoomCard room={o} sizes="(min-width: 1240px) 260px, (min-width: 560px) 50vw, 100vw" />
                    </Reveal>
                  ))}
                </div>
              </section>
            </>
          ) : null}
        </div>

        <HeroRise order={2} className="min-[980px]:sticky min-[980px]:top-[104px]">
          <RoomBookingCard
            room={{
              slug: room.slug,
              name: room.name,
              category: room.category,
              baseRate: room.baseRate,
              weekendRate: room.weekendRate,
              maxAdults: room.maxAdults,
              maxChildren: room.maxChildren,
            }}
            phone={{ display: displayPhone(main.number), href: telHref(main.number) }}
            whatsapp={wa ? { display: displayPhone(wa.number), href: whatsappHref(wa.number) } : null}
            maxNights={settings.maxNights}
            windowDays={settings.bookingWindowDays}
          />
        </HeroRise>
      </div>

      <RoomMobileBar rate={formatNaira(room.baseRate)} />
      <JsonLd data={roomJsonLd(room)} />
    </>
  );
}
