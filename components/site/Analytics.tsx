"use client";

import dynamic from "next/dynamic";
import { useEffect, useSyncExternalStore } from "react";
import { buttonVariants } from "@/components/ui/button";
import { CONSENT_KEY, track } from "@/lib/analytics";

// GA4 after consent (docs/05, docs/07). Renders nothing unless NEXT_PUBLIC_GA_ID
// is set. The Google tag (and @next/third-parties) is only downloaded once the
// visitor accepts, so it costs nothing on first load.

const GoogleAnalytics = dynamic(() => import("@next/third-parties/google").then((m) => m.GoogleAnalytics), { ssr: false });

type Consent = "granted" | "denied" | null;

// Consent lives in localStorage; a tiny store lets the banner re-render on change.
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

// Remembers the choice even when storage is blocked (private windows).
let memo: Consent = null;

function readConsent(): Consent {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

function setConsent(value: "granted" | "denied") {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {}
  memo = value;
  listeners.forEach((fn) => fn());
}

export function Analytics({ gaId }: { gaId?: string }) {
  // undefined on the server and first paint: show nothing until the client reads storage.
  const consent = useSyncExternalStore<Consent | undefined>(subscribe, () => memo ?? readConsent(), () => undefined);

  // Calls and WhatsApp taps anywhere on the site (docs/07 events).
  useEffect(() => {
    if (consent !== "granted") return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]");
      const href = a?.getAttribute("href") ?? "";
      if (href.startsWith("tel:")) track("click_call");
      else if (href.includes("wa.me/")) track("click_whatsapp");
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [consent]);

  if (!gaId || consent === undefined) return null;

  if (consent === "granted") return <GoogleAnalytics gaId={gaId} />;
  if (consent === "denied") return null;

  return (
    <section
      aria-label="Analytics cookies"
      className="fixed inset-x-3 bottom-[calc(88px+env(safe-area-inset-bottom))] z-40 mx-auto max-w-[460px] border border-line bg-paper p-4 shadow-lg min-[760px]:right-auto min-[760px]:bottom-6 min-[760px]:left-6"
    >
      <p className="m-0 text-sm text-body">
        May we use analytics cookies to see which pages help guests book? No advertising, and nothing that identifies you.{" "}
        <a href="/privacy">Privacy notice</a>
      </p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setConsent("granted")} className={buttonVariants({ variant: "amber", size: "cta" })}>
          Accept
        </button>
        <button type="button" onClick={() => setConsent("denied")} className={buttonVariants({ variant: "line", size: "cta" })}>
          No thanks
        </button>
      </div>
    </section>
  );
}
