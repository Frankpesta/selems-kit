import Image from "next/image";
import Link from "next/link";
import type { ContactLinks } from "./nav";

type Props = {
  year: number;
  hotelName: string;
  address: string;
  contact: ContactLinks;
  phones: { label: string; display: string; href: string; whatsapp: boolean }[];
  bookingEmail: string;
  socials: { label: string; href: string }[];
};

export function SiteFooter({ year, hotelName, address, phones, bookingEmail, socials }: Props) {
  return (
    <footer className="bg-ink-2 text-[#C9D1D5]">
      <div className="container-site flex flex-col gap-14 pt-20 pb-8">
        <div className="grid grid-cols-1 gap-10 min-[760px]:grid-cols-2 min-[980px]:grid-cols-4">
          <div className="flex flex-col gap-5">
            <Image
              src="/images/selems-logo.png"
              alt={`${hotelName} logo`}
              width={240}
              height={57}
              className="h-auto w-[240px]"
            />
            <address className="text-[15px] not-italic">{address}, Nigeria</address>
          </div>
          <FooterColumn
            title="Stay"
            links={[
              { href: "/rooms", label: "Rooms & suites" },
              { href: "/book", label: "Book a room" },
              { href: "/offers", label: "Offers" },
              { href: "/akure-guide", label: "Where to stay in Akure" },
            ]}
          />
          <FooterColumn
            title="Hotel"
            links={[
              { href: "/dining", label: "Dining & bars" },
              { href: "/facilities", label: "Facilities" },
              { href: "/gallery", label: "Gallery" },
              { href: "/contact", label: "Contact" },
            ]}
          />
          <div>
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#8FA0AA]">Reservations</h2>
            <ul className="flex flex-col gap-2.5 text-[15px] tabular-nums">
              {phones.map((p) => (
                <li key={p.href}>
                  <a href={p.href} className="text-[#E6EAEC] no-underline hover:text-amber-tint">
                    {p.display}
                  </a>
                  {p.whatsapp ? " (WhatsApp)" : null}
                </li>
              ))}
              <li>
                <a href={`mailto:${bookingEmail}`} className="break-all text-[#E6EAEC] no-underline hover:text-amber-tint">
                  {bookingEmail}
                </a>
              </li>
              {socials.length ? (
                <li className="flex flex-wrap gap-x-2">
                  {socials.map((s, i) => (
                    <span key={s.href}>
                      {i > 0 ? "· " : null}
                      <a href={s.href} rel="me noopener" className="text-[#E6EAEC] no-underline hover:text-amber-tint">
                        {s.label}
                      </a>
                    </span>
                  ))}
                </li>
              ) : null}
            </ul>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-4 border-t border-white/12 pt-6 text-[13px] text-[#8FA0AA]">
          <span>
            © {year} {hotelName}
          </span>
          <span>
            <Link href="/privacy" className="text-[#C9D1D5] no-underline hover:text-amber-tint">
              Privacy
            </Link>
            {" · "}
            <Link href="/terms" className="text-[#C9D1D5] no-underline hover:text-amber-tint">
              Booking terms
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#8FA0AA]">{title}</h2>
      <ul className="flex flex-col gap-2.5 text-[15px]">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-[#E6EAEC] no-underline hover:text-amber-tint">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
