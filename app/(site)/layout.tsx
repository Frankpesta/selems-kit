import { getRooms, getSettings, getYear } from "@/lib/data";
import { addressLine, displayPhone, mainPhone, telHref, whatsappHref, whatsappPhone } from "@/lib/contact";
import { formatNaira } from "@/lib/money";
import { hotelJsonLd } from "@/lib/seo";
import { UtilityBar } from "@/components/site/UtilityBar";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { MobileBookBar } from "@/components/site/MobileBookBar";
import { WhatsAppButton } from "@/components/site/WhatsAppButton";
import { JsonLd } from "@/components/seo/JsonLd";
import { MotionProvider } from "@/components/motion/MotionProvider";

const HOTEL_IMAGES = [
  "/images/selems-hotel-akure-exterior-front.jpg",
  "/images/selems-hotel-akure-royal-suite-bed.jpg",
  "/images/selems-hotel-akure-restaurant-dining-room.jpg",
];

export default async function SiteLayout({ children }: LayoutProps<"/">) {
  const [settings, rooms, year] = await Promise.all([getSettings(), getRooms(), getYear()]);
  const main = mainPhone(settings.phones);
  const wa = whatsappPhone(settings.phones);
  const contact = {
    phone: displayPhone(main.number),
    phoneHref: telHref(main.number),
    whatsappHref: wa ? whatsappHref(wa.number) : null,
  };
  const fromRate = rooms.length ? Math.min(...rooms.map((r) => r.fromRate)) : null;
  const socials = [
    { label: "Instagram", href: settings.socials.instagram },
    { label: "Facebook", href: settings.socials.facebook },
    { label: "X", href: settings.socials.x },
    { label: "TikTok", href: settings.socials.tiktok },
  ].filter((s): s is { label: string; href: string } => !!s.href);

  return (
    <MotionProvider>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-paper focus:px-4 focus:py-3 focus:text-ink"
      >
        Skip to content
      </a>
      <UtilityBar address={addressLine(settings.address)} contact={contact} />
      <SiteHeader contact={contact} />
      <main id="main">{children}</main>
      <SiteFooter
        year={year}
        hotelName={settings.hotelName}
        address={addressLine(settings.address)}
        contact={contact}
        phones={settings.phones.map((p) => ({
          label: p.label,
          display: displayPhone(p.number),
          href: telHref(p.number),
          whatsapp: p.whatsapp,
        }))}
        bookingEmail={settings.emails.booking}
        socials={socials}
      />
      {fromRate !== null ? <MobileBookBar fromRate={formatNaira(fromRate)} /> : null}
      {wa ? <WhatsAppButton href={whatsappHref(wa.number, "Hello Selems, I'd like to ask about a room.")} /> : null}
      <JsonLd
        data={hotelJsonLd(
          settings,
          rooms.flatMap((r) => [r.baseRate, r.weekendRate ?? r.baseRate]),
          HOTEL_IMAGES,
        )}
      />
    </MotionProvider>
  );
}
