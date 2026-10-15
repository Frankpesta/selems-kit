import type { Metadata } from "next";
import { MailIcon, MessageCircleIcon, PhoneIcon } from "lucide-react";
import { Faq, SectionHeading } from "@/components/site/blocks";
import { ContactForm } from "@/components/site/ContactForm";
import { MapPanel } from "@/components/site/MapPanel";
import { PageIntro } from "@/components/site/PageIntro";
import { JsonLd } from "@/components/seo/JsonLd";
import { Reveal } from "@/components/motion/Reveal";
import { STAGGER } from "@/components/motion/tokens";
import { getFaqs, getPage, getSettings } from "@/lib/data";
import { addressLine, displayPhone, mainPhone, mapsEmbedSrc, mapsHref, telHref, whatsappHref, whatsappPhone } from "@/lib/contact";
import { paragraphs, str } from "@/lib/fields";
import { contactPageJsonLd, pageMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("contact");
  return pageMetadata({
    title: page?.seoTitle ?? "Contact & Directions | Selems Hotel, Ijapo Akure",
    description: page?.seoDescription ?? "",
    path: "/contact",
  });
}

export default async function ContactPage() {
  const [page, s, faqs] = await Promise.all([getPage("contact"), getSettings(), getFaqs("contact")]);
  const f = page?.fields ?? {};
  const main = mainPhone(s.phones);
  const wa = whatsappPhone(s.phones);
  const others = s.phones.filter((p) => p.number !== main.number);
  const address = addressLine(s.address);
  const directions = paragraphs(f.directions);

  const ways = [
    {
      icon: PhoneIcon,
      label: "Call",
      value: displayPhone(main.number),
      href: telHref(main.number),
      note: others.length ? `Also ${others.map((p) => displayPhone(p.number)).join(", ")}` : "Front office, 24 hours",
    },
    ...(wa
      ? [{ icon: MessageCircleIcon, label: "WhatsApp", value: displayPhone(wa.number), href: whatsappHref(wa.number, "Hello Selems, "), note: "Open a chat" }]
      : []),
    {
      icon: MailIcon,
      label: "Email",
      value: s.emails.booking,
      href: `mailto:${s.emails.booking}`,
      note: `General: ${s.emails.info}`,
    },
  ];

  return (
    <>
      <PageIntro crumbs={[{ name: "Contact", path: "/contact" }]} title={str(f.h1, "Contact the hotel")} lede={str(f.lede)}>
        <ul className="m-0 mt-4 grid list-none grid-cols-1 border-y border-line-strong p-0 min-[760px]:grid-cols-3">
          {ways.map((w, i) => (
            <Reveal as="li" key={w.label} delay={i * STAGGER} className={i > 0 ? "border-t border-line-strong min-[760px]:border-t-0 min-[760px]:border-l" : undefined}>
              <a href={w.href} className="group flex h-full flex-col gap-2 p-6 text-ink no-underline transition-colors hover:bg-paper hover:text-ink">
                <span className="eyebrow flex items-center gap-2">
                  <w.icon className="size-4 text-amber" aria-hidden="true" /> {w.label}
                </span>
                <span className="font-display text-[26px] tabular-nums group-hover:text-amber min-[760px]:text-[28px]">
                  {w.value.includes("@") ? (
                    <>
                      {w.value.split("@")[0]}
                      <wbr />@{w.value.split("@")[1]}
                    </>
                  ) : (
                    w.value
                  )}
                </span>
                <span className="text-sm text-muted-foreground">{w.note}</span>
              </a>
            </Reveal>
          ))}
        </ul>
      </PageIntro>

      <section aria-label="Message and location" className="pb-24">
        <div className="container-site grid grid-cols-1 items-start gap-12 min-[980px]:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <Reveal>
            <ContactForm />
          </Reveal>
          <Reveal delay={STAGGER} className="flex flex-col gap-6">
            <div>
              <p className="eyebrow m-0">Address</p>
              <address className="mt-2 text-lg not-italic">
                {s.hotelName}
                <br />
                {address}, Nigeria
              </address>
            </div>
            <MapPanel embedSrc={mapsEmbedSrc(s.hotelName, s.address, s.geo, s.mapEmbedUrl)} mapsHref={mapsHref(s.hotelName, s.address, s.geo)} address={address} />
            {directions.length ? (
              <div className="flex flex-col gap-3">
                <h2 className="font-display m-0 text-[28px]">Finding us</h2>
                {directions.map((p) => (
                  <p key={p.slice(0, 24)} className="m-0 text-body">
                    {p}
                  </p>
                ))}
              </div>
            ) : null}
          </Reveal>
        </div>
      </section>

      {faqs.length ? (
        <section aria-labelledby="contact-faq" className="bg-paper py-[72px] min-[760px]:py-28">
          <div className="container-site grid grid-cols-1 items-start gap-12 min-[760px]:grid-cols-2">
            <Reveal>
              <SectionHeading id="contact-faq" eyebrow="Before you write" title="Common questions" />
            </Reveal>
            <Reveal delay={STAGGER}>
              <Faq faqs={faqs} />
            </Reveal>
          </div>
        </section>
      ) : null}

      <JsonLd data={contactPageJsonLd("/contact")} />
    </>
  );
}
