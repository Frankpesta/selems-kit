import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/site/Logo";

// Stragglers from the old WordPress site (and typos) land here (docs/05).
export const metadata: Metadata = {
  title: "Page not found | Selems Exclusive Hotel & Suites, Akure",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <header className="border-b border-line bg-stone">
        <div className="container-site flex min-h-[64px] items-center min-[560px]:min-h-[76px]">
          <Link href="/" aria-label="Selems Exclusive Hotel & Suites, home" className="flex items-center no-underline">
            <Logo />
          </Link>
        </div>
      </header>
      <main id="main" className="container-site flex min-h-[70vh] max-w-[760px] flex-col items-start justify-center gap-6 py-20">
        <p className="eyebrow m-0">404</p>
        <h1 className="font-display text-page m-0">This page has moved</h1>
        <p className="lede m-0">
          We&rsquo;ve rebuilt our website, so some old links no longer work. Everything is still here: rooms, prices and
          online booking.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/rooms" className={buttonVariants({ variant: "line", size: "cta" })}>
            Rooms &amp; prices
          </Link>
          <Link href="/book" className={buttonVariants({ variant: "amber", size: "cta" })}>
            Book a room
          </Link>
          <Link href="/contact" className={buttonVariants({ variant: "line", size: "cta" })}>
            Contact us
          </Link>
        </div>
        <Link href="/" className="font-semibold">
          Go to the home page
        </Link>
      </main>
    </>
  );
}
