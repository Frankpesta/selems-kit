import Link from "next/link";
import { LockIcon, PhoneIcon } from "lucide-react";
import { MotionProvider } from "@/components/motion/MotionProvider";
import { Logo } from "@/components/site/Logo";
import { getSettings } from "@/lib/data";
import { displayPhone, mainPhone, telHref } from "@/lib/contact";

// Minimal chrome for the booking flow and guest booking page (docs/05): no
// navigation to wander off into, just the brand and a way to get help.
export default async function BookingLayout({ children }: LayoutProps<"/">) {
  const settings = await getSettings();
  const main = mainPhone(settings.phones);
  return (
    <MotionProvider>
      <header className="border-b border-line bg-stone">
        <div className="container-site flex min-h-[64px] items-center justify-between gap-4 min-[560px]:min-h-[76px]">
          <Link href="/" aria-label="Selems Exclusive Hotel & Suites, back to the home page" className="flex flex-none items-center no-underline">
            <Logo />
          </Link>
          <p className="m-0 hidden items-center gap-2 text-sm text-body min-[480px]:flex">
            <LockIcon className="size-4 text-ok" aria-hidden="true" />
            <span className="hidden min-[640px]:inline">Secure booking ·&nbsp;</span>Help:{" "}
            <a href={telHref(main.number)} className="font-semibold whitespace-nowrap tabular-nums">
              {displayPhone(main.number)}
            </a>
          </p>
          <a
            href={telHref(main.number)}
            aria-label={`Call the hotel for help: ${displayPhone(main.number)}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-sm border border-line-strong px-3 text-sm font-semibold text-ink no-underline min-[480px]:hidden"
          >
            <PhoneIcon className="size-4 text-amber" aria-hidden="true" /> Call for help
          </a>
        </div>
      </header>
      <main id="main">{children}</main>
    </MotionProvider>
  );
}
