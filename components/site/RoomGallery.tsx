"use client";

import Image from "next/image";
import { useState } from "react";
import { ImagesIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Lightbox } from "./Lightbox";

type Img = { url: string; alt: string; width: number; height: number };

// Room photos: a large cover plus up to four thumbnails, opening the shared
// Lightbox (docs/05).
export function RoomGallery({ images, name }: { images: Img[]; name: string }) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  const count = images.length;
  if (count === 0) return null;
  const thumbs = images.slice(1, 5);

  return (
    <>
      <div
        className={cn(
          "grid gap-2.5",
          thumbs.length === 0
            ? "grid-cols-1"
            : "grid-cols-2 grid-rows-[260px_160px_160px] min-[980px]:grid-cols-[2fr_1fr_1fr] min-[980px]:grid-rows-[240px_240px]",
        )}
      >
        <button
          type="button"
          onClick={() => setOpenAt(0)}
          className={cn(
            "group relative overflow-hidden",
            thumbs.length === 0 ? "aspect-[16/9] min-[980px]:aspect-[21/9]" : "col-span-2 min-[980px]:col-span-1 min-[980px]:row-span-2",
          )}
          aria-label={`Open photo 1 of ${count}: ${images[0].alt}`}
        >
          <Image
            src={images[0].url}
            alt={images[0].alt}
            width={images[0].width}
            height={images[0].height}
            priority
            fetchPriority="high"
            sizes="(min-width: 1240px) 1240px, 100vw"
            className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
          />
        </button>
        {thumbs.map((img, i) => (
          <button
            key={img.url}
            type="button"
            onClick={() => setOpenAt(i + 1)}
            aria-label={`Open photo ${i + 2} of ${count}: ${img.alt}`}
            className="group relative overflow-hidden"
          >
            <Image
              src={img.url}
              alt={img.alt}
              width={img.width}
              height={img.height}
              sizes="(min-width: 980px) 420px, 50vw"
              className="h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.05]"
            />
          </button>
        ))}
      </div>
      {count > 1 ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => setOpenAt(0)}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-amber hover:text-amber-dark"
          >
            <ImagesIcon className="size-4" aria-hidden="true" />
            All {count} photos
          </button>
        </div>
      ) : null}
      <Lightbox images={images} label={`${name} photos`} openAt={openAt} onClose={() => setOpenAt(null)} />
    </>
  );
}
