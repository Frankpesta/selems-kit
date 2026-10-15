import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { formatNaira } from "@/lib/money";
import type { RoomCard as RoomCardData } from "@/lib/data";
import { Tag } from "./Tag";

// Room card (docs/02): 4:3 photo, name, nightly price, one-line facts, Details + Book.
// No "use client": renders on the server, and inside the Rooms filter island.
export function RoomCard({
  room,
  headingLevel = "h3",
  priority = false,
  sizes = "(min-width: 1240px) 400px, (min-width: 760px) 33vw, 100vw",
}: {
  room: RoomCardData;
  headingLevel?: "h2" | "h3";
  priority?: boolean;
  sizes?: string;
}) {
  const H = headingLevel;
  const href = `/rooms/${room.slug}`;
  return (
    <article className="group flex w-full flex-col gap-4">
      <Link href={href} className="block overflow-hidden" tabIndex={-1} aria-hidden="true">
        {room.cover ? (
          <Image
            src={room.cover.url}
            alt={room.cover.alt}
            width={room.cover.width}
            height={room.cover.height}
            sizes={sizes}
            priority={priority}
            className="aspect-[4/3] w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]"
          />
        ) : null}
      </Link>
      <div className="flex items-baseline justify-between gap-3">
        <H className="font-display text-card-title m-0">
          <Link href={href} className="text-ink no-underline hover:text-amber">
            {room.name}
          </Link>
        </H>
        <p className="m-0 font-semibold whitespace-nowrap tabular-nums">
          {formatNaira(room.baseRate)}
          <span className="font-normal text-muted-foreground"> / night</span>
        </p>
      </div>
      {room.category === "suite" ? (
        <div className="-mt-2">
          <Tag>Suite</Tag>
        </div>
      ) : null}
      <p className="m-0 text-body">{room.facts.filter((f) => f !== "Suite").join(" · ")}</p>
      <div className="mt-auto flex gap-3">
        <Link href={href} className={buttonVariants({ variant: "line", size: "cta-sm" })}>
          Details<span className="sr-only">: {room.name}</span>
        </Link>
        <Link href={`/book?room=${room.slug}`} className={buttonVariants({ variant: "amber", size: "cta-sm" })}>
          Book<span className="sr-only"> the {room.name}</span>
        </Link>
      </div>
    </article>
  );
}
