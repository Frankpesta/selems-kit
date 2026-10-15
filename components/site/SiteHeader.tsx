"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { m } from "framer-motion";
import { DURATION, EASE_OUT } from "@/components/motion/tokens";
import { MenuIcon, PhoneIcon, XIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { NAV_LINKS, type ContactLinks } from "./nav";
import { Logo } from "./Logo";

// One row that never wraps (docs/02). Dark over the home hero. Below 1100px the
// links and "Book a room" collapse into a menu sheet. The sheet is a native
// <dialog> (focus trap, Esc, inert page for free) to keep JS off every page.
export function SiteHeader({ contact }: { contact: ContactLinks }) {
  const pathname = usePathname();
  const dark = pathname === "/";
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const menu = useRef<HTMLDialogElement>(null);
  const openMenu = () => menu.current?.showModal();
  const closeMenu = () => menu.current?.close();

  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 8);
      // Hide while scrolling down past the hero; show again on any scroll up.
      if (Math.abs(y - last) > 6) {
        setHidden(y > last && y > 320 && !menu.current?.open);
        last = y;
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <m.header
      initial={false}
      animate={{ y: hidden ? "-100%" : "0%" }}
      transition={{ duration: hidden ? DURATION.ui + 0.1 : DURATION.reveal / 2, ease: EASE_OUT }}
      onFocusCapture={() => setHidden(false)}
      className={cn(
        "sticky top-0 z-40 border-b transition-shadow",
        dark ? "border-white/12 bg-ink text-stone" : "border-line bg-stone text-ink",
        scrolled && "shadow-[0_1px_0_rgba(23,34,45,.06),0_8px_24px_-12px_rgba(23,34,45,.25)]",
      )}
    >
      <div className="container-site flex min-h-[64px] flex-nowrap items-center gap-4 min-[560px]:min-h-[76px] min-[1100px]:gap-10">
        <Link href="/" aria-label="Selems Exclusive Hotel & Suites, home" className="flex flex-none items-center rounded-[2px] no-underline">
          <Logo />
        </Link>

        <nav aria-label="Main" className="hidden min-w-0 flex-1 flex-nowrap justify-center gap-[30px] min-[1100px]:flex">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={isActive(l.href) ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b border-transparent py-1.5 text-[14.5px] font-medium text-inherit no-underline hover:border-amber hover:text-inherit",
                isActive(l.href) && "border-amber",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <Link href="/book" className={cn(buttonVariants({ variant: "amber", size: "cta" }), "hidden flex-none min-[1100px]:inline-flex")}>
          Book a room
        </Link>

        <div className="ml-auto flex items-center gap-2 min-[1100px]:hidden">
          <a
            href={contact.phoneHref}
            aria-label={`Call the hotel on ${contact.phone}`}
            className="inline-flex size-11 items-center justify-center rounded-sm border border-current text-inherit hover:text-inherit min-[720px]:hidden"
          >
            <PhoneIcon className="size-5" strokeWidth={1.6} aria-hidden="true" />
          </a>
          <button
            type="button"
            aria-label="Open menu"
            aria-haspopup="dialog"
            onClick={openMenu}
            className="inline-flex size-11 items-center justify-center rounded-sm border border-current bg-transparent text-inherit min-[560px]:size-12"
          >
            <MenuIcon className="size-[22px]" strokeWidth={1.6} aria-hidden="true" />
          </button>
          <dialog
            ref={menu}
            aria-label="Menu"
            onClick={(e) => e.target === e.currentTarget && closeMenu()}
            className="m-0 ml-auto h-dvh max-h-dvh w-[min(88vw,380px)] max-w-none overflow-y-auto border-0 bg-stone p-0 text-ink backdrop:bg-ink/50 open:animate-in open:slide-in-from-right"
          >
            <div className="flex items-start justify-between border-b border-line px-6 py-5">
              <Logo priority={false} className="h-10 min-[560px]:h-10" />
              <button
                type="button"
                onClick={closeMenu}
                aria-label="Close menu"
                className="inline-flex size-11 items-center justify-center rounded-sm text-ink hover:bg-mist"
              >
                <XIcon className="size-5" strokeWidth={1.6} aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Menu" className="flex flex-col px-6">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={closeMenu}
                  aria-current={isActive(l.href) ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 items-center border-b border-line text-lg text-ink no-underline hover:text-amber",
                    isActive(l.href) && "text-amber",
                  )}
                >
                  {l.label}
                </Link>
              ))}
            </nav>
            <div className="flex flex-col gap-3 px-6 py-6">
              <Link href="/book" onClick={closeMenu} className={cn(buttonVariants({ variant: "amber", size: "cta" }), "w-full")}>
                Book a room
              </Link>
              <a href={contact.phoneHref} className={cn(buttonVariants({ variant: "line", size: "cta" }), "w-full")}>
                Call {contact.phone}
              </a>
              {contact.whatsappHref ? (
                <a href={contact.whatsappHref} className={cn(buttonVariants({ variant: "line", size: "cta" }), "w-full")}>
                  WhatsApp the front desk
                </a>
              ) : null}
            </div>
          </dialog>
        </div>
      </div>
    </m.header>
  );
}
