"use client";

import { useState } from "react";
import { MapPinIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

// Google Map loads only when asked (docs/05): protects LCP and privacy.
export function MapPanel({ embedSrc, mapsHref, address }: { embedSrc: string; mapsHref: string; address: string }) {
  const [show, setShow] = useState(false);
  if (show) {
    return (
      <iframe
        src={embedSrc}
        title={`Map showing ${address}`}
        className="h-[300px] w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }
  return (
    <div className="flex h-[300px] flex-col items-center justify-center gap-4 border border-line bg-mist px-6 text-center">
      <MapPinIcon className="size-8 text-amber" strokeWidth={1.5} aria-hidden="true" />
      <p className="m-0 max-w-[36ch] text-body">{address}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className={buttonVariants({ variant: "line", size: "cta-sm" })} onClick={() => setShow(true)}>
          Show interactive map
        </button>
        <a href={mapsHref} target="_blank" rel="noopener" className={buttonVariants({ variant: "amber", size: "cta-sm" })}>
          Open in Google Maps
        </a>
      </div>
    </div>
  );
}
