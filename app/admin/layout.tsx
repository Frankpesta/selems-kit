import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import { connection } from "next/server";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import { AdminProviders } from "@/components/admin/AdminProviders";

// Staff area (docs/06): client-rendered with live Convex queries, never indexed.
// Convex Auth's server provider reads cookies, so it lives here and not in the
// root layout, keeping public pages static (docs/03 decisions).

export const metadata: Metadata = {
  title: { default: "Selems admin", template: "%s · Selems admin" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div data-surface="admin" className="min-h-dvh bg-stone text-ink">
      <Suspense fallback={<AdminLoading />}>
        <AuthProvider>{children}</AuthProvider>
      </Suspense>
    </div>
  );
}

/**
 * The provider reads the auth cookies and stamps `Date.now()`, so it must render
 * per request: `connection()` tells Next not to prerender it (Cache Components
 * otherwise rejects the clock read).
 */
async function AuthProvider({ children }: { children: ReactNode }) {
  await connection();
  return (
    <ConvexAuthNextjsServerProvider>
      <AdminProviders>{children}</AdminProviders>
    </ConvexAuthNextjsServerProvider>
  );
}

function AdminLoading() {
  return (
    <div className="grid min-h-dvh place-items-center text-sm text-muted" role="status">
      Loading…
    </div>
  );
}
