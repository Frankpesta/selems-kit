import type { ReactNode } from "react";
import { Breadcrumbs } from "./blocks";
import { HeroRise } from "@/components/motion/HeroIntro";
import { cn } from "@/lib/utils";

// Standard top of a content page: breadcrumbs, H1, lede (docs/05).
export function PageIntro({
  crumbs,
  title,
  lede,
  children,
  className,
}: {
  crumbs: { name: string; path: string }[];
  title: string;
  lede?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("pt-10 pb-10 min-[760px]:pt-14 min-[760px]:pb-14", className)}>
      <div className="container-site flex flex-col gap-6">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, ...crumbs]} />
        <div className="grid grid-cols-1 items-end gap-6 min-[760px]:grid-cols-2">
          <HeroRise order={0}>
            <h1 className="font-display text-page m-0">{title}</h1>
          </HeroRise>
          {lede ? (
            <HeroRise order={1}>
              <p className="lede m-0">{lede}</p>
            </HeroRise>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  );
}
