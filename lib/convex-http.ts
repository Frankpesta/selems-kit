"use client";

import type { FunctionArgs, FunctionReference, FunctionReturnType } from "convex/server";

// One-off Convex calls from content pages (room quote, contact form) without
// the live client: the HTTP client is loaded on first use, so these pages ship
// no Convex code up front and open no websocket. The booking flow, where live
// availability matters, still uses ConvexReactClient.
type Client = import("convex/browser").ConvexHttpClient;
let client: Promise<Client> | null = null;
const getClient = () =>
  (client ??= import("convex/browser").then((m) => new m.ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!)));

export async function convexQuery<Q extends FunctionReference<"query">>(
  query: Q,
  args: FunctionArgs<Q>,
): Promise<FunctionReturnType<Q>> {
  return (await getClient()).query(query, args);
}

export async function convexAction<A extends FunctionReference<"action">>(
  action: A,
  args: FunctionArgs<A>,
): Promise<FunctionReturnType<A>> {
  return (await getClient()).action(action, args);
}

/** Start loading the client early (e.g. when a visitor focuses a form). */
export const preloadConvex = () => void getClient();
