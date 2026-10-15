import Image from "next/image";
import { cn } from "@/lib/utils";

// The hotel's logo lockup (SE monogram, buffalo, wordmark). 2276×541 source;
// next/image serves a small WebP/AVIF at the rendered height.
export function Logo({ className, priority = true }: { className?: string; priority?: boolean }) {
  return (
    <Image
      src="/images/selems-logo.png"
      alt="Selems Exclusive Hotel & Suites"
      width={2276}
      height={541}
      priority={priority}
      sizes="(min-width: 560px) 220px, 170px"
      className={cn("h-10 w-auto min-[560px]:h-[52px]", className)}
    />
  );
}
