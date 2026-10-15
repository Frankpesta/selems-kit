"use client";

import type { ReactNode } from "react";
import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

// The staff area's own Convex client, authenticated through Convex Auth.
let client: ConvexReactClient | null = null;
const getClient = () => (client ??= new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!));

export function AdminProviders({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthNextjsProvider client={getClient()}>
      <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      <Toaster theme="light" position="bottom-right" richColors closeButton />
    </ConvexAuthNextjsProvider>
  );
}
