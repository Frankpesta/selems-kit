import Link from "next/link";
import {
  CarIcon,
  CircleIcon,
  ClockIcon,
  ConciergeBellIcon,
  ShieldCheckIcon,
  ShirtIcon,
  TvIcon,
  UtensilsIcon,
  WifiIcon,
  WineIcon,
  ZapIcon,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, faqJsonLd } from "@/lib/seo";
export { RoomCard } from "./RoomCard";

// Small server components shared by public pages (docs/02 "Components").

export function SectionHeading({
  eyebrow,
  title,
  id,
  className,
  tone = "light",
}: {
  eyebrow?: string;
  title: string;
  id: string;
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {eyebrow ? <p className={cn("eyebrow m-0", tone === "dark" && "text-amber-tint")}>{eyebrow}</p> : null}
      <h2 id={id} className="font-display text-section m-0">
        {title}
      </h2>
    </div>
  );
}

export { Tag } from "./Tag";

export function FactsStrip({ facts }: { facts: { value: string; label: string }[] }) {
  return (
    <dl className="m-0 grid grid-cols-2 border-y border-line-strong min-[980px]:grid-cols-4">
      {facts.map((f, i) => (
        <div
          key={f.label}
          className={cn(
            "flex flex-col-reverse px-6 py-7",
            i % 2 === 1 && "border-l border-line-strong",
            i >= 2 && "border-t border-line-strong min-[980px]:border-t-0",
            i === 2 && "min-[980px]:border-l",
          )}
        >
          <dt className="mt-1 text-body">{f.label}</dt>
          <dd className="font-display m-0 text-[32px] tabular-nums min-[760px]:text-[44px]">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const ICONS: Record<string, LucideIcon> = {
  clock: ClockIcon,
  "concierge-bell": ConciergeBellIcon,
  wifi: WifiIcon,
  tv: TvIcon,
  utensils: UtensilsIcon,
  car: CarIcon,
  wine: WineIcon,
  zap: ZapIcon,
  shield: ShieldCheckIcon,
  shirt: ShirtIcon,
};

export function AmenityIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? CircleIcon;
  return <Icon className={cn("size-7 flex-none text-amber", className)} strokeWidth={1.5} aria-hidden="true" />;
}

export function AmenityRow({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="flex items-start gap-4 border-t border-line py-6">
      <AmenityIcon name={icon} />
      <div>
        <h3 className="m-0 text-[17px] font-semibold">{title}</h3>
        <p className="mt-1 mb-0 text-body">{body}</p>
      </div>
    </div>
  );
}

/** FAQ list as native <details> (works without JS, answers stay in the HTML) + FAQPage JSON-LD. */
export function Faq({ faqs }: { faqs: { question: string; answer: string }[] }) {
  if (faqs.length === 0) return null;
  return (
    <div>
      {faqs.map((f, i) => (
        <details key={f.question} open={i === 0} className="group border-t border-line-strong py-5 last:border-b">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-[17px] font-semibold [&::-webkit-details-marker]:hidden">
            {f.question}
            <span aria-hidden="true" className="text-xl leading-none text-amber group-open:hidden">
              +
            </span>
            <span aria-hidden="true" className="hidden text-xl leading-none text-amber group-open:inline">
              –
            </span>
          </summary>
          <p className="mt-3 mb-0 max-w-[70ch] text-body">{f.answer}</p>
        </details>
      ))}
      <JsonLd data={faqJsonLd(faqs)} />
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { name: string; path: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] text-muted-foreground">
      <ol className="m-0 flex list-none flex-wrap gap-x-2 p-0">
        {items.map((it, i) => (
          <li key={it.path} className="flex gap-2">
            {i > 0 ? <span aria-hidden="true">/</span> : null}
            {i === items.length - 1 ? (
              <span aria-current="page">{it.name}</span>
            ) : (
              <Link href={it.path} className="text-muted-foreground no-underline hover:text-amber">
                {it.name}
              </Link>
            )}
          </li>
        ))}
      </ol>
      <JsonLd data={breadcrumbJsonLd(items)} />
    </nav>
  );
}
