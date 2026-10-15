"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";

// Live Convex data for client islands (booking card, booking flow, guest page).
// Mounted only around those islands so content pages don't ship the client.
let client: ConvexReactClient | null = null;
const getClient = () => (client ??= new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!));

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={getClient()}>{children}</ConvexProvider>;
}
