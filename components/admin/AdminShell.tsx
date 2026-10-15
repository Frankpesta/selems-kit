"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import {
  BedDoubleIcon,
  CalendarDaysIcon,
  CircleHelpIcon,
  ClipboardListIcon,
  FileTextIcon,
  HistoryIcon,
  HomeIcon,
  ImagesIcon,
  LogOutIcon,
  MenuIcon,
  MessageSquareIcon,
  SearchIcon,
  SettingsIcon,
  SparklesIcon,
  StarIcon,
  TagIcon,
  UsersIcon,
} from "lucide-react";
import { cn } from "cn";
import { api } from "@/convex/_generated/api";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { formatDateShort } from "@/lib/format";
import { Btn, Loading, Pill } from "./ui";
import { STATUS } from "./lib";

// Admin shell (docs/06 "Shell"): ink sidebar, user chip, global search.

type Me = { name: string; email: string; role: "admin" | "staff" };
const MeContext = createContext<Me | null>(null);

/** The signed-in staff member (inside the shell, never null). */
export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe outside AdminShell");
  return me;
}

type NavItem = { href: string; label: string; icon: typeof HomeIcon; adminOnly?: boolean; badge?: "attention" | "inquiries" | "reviews"; match?: string };
const NAV: { group?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/admin", label: "Today", icon: HomeIcon },
      { href: "/admin/reservations", label: "Reservations", icon: ClipboardListIcon, badge: "attention" },
      { href: "/admin/availability", label: "Availability", icon: CalendarDaysIcon },
      { href: "/admin/rooms", label: "Rooms & rates", icon: BedDoubleIcon, adminOnly: true },
    ],
  },
  {
    group: "Website",
    items: [
      { href: "/admin/content/home", label: "Content & SEO", icon: FileTextIcon, adminOnly: true, match: "/admin/content" },
      { href: "/admin/offers", label: "Offers", icon: TagIcon, adminOnly: true },
      { href: "/admin/gallery", label: "Gallery", icon: ImagesIcon, adminOnly: true },
      { href: "/admin/faqs", label: "FAQs", icon: CircleHelpIcon, adminOnly: true },
      { href: "/admin/facilities", label: "Facilities", icon: SparklesIcon, adminOnly: true },
      { href: "/admin/reviews", label: "Reviews", icon: StarIcon, adminOnly: true, badge: "reviews" },
      { href: "/admin/inquiries", label: "Inquiries", icon: MessageSquareIcon, badge: "inquiries" },
    ],
  },
  {
    group: "Hotel",
    items: [
      { href: "/admin/staff", label: "Staff", icon: UsersIcon, adminOnly: true },
      { href: "/admin/settings", label: "Settings", icon: SettingsIcon, adminOnly: true },
      { href: "/admin/audit", label: "Activity log", icon: HistoryIcon, adminOnly: true },
    ],
  },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const me = useQuery(api.users.me, isAuthenticated ? {} : "skip");
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace(`/admin/login?next=${encodeURIComponent(location.pathname)}`);
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated || me === undefined) return <Loading />;
  if (me === null) return <NoAccess />;
  return (
    <MeContext.Provider value={me}>
      <Frame me={me}>{children}</Frame>
    </MeContext.Provider>
  );
}

function NoAccess() {
  const { signOut } = useAuthActions();
  const router = useRouter();
  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="max-w-md rounded-lg border border-line bg-white p-8 text-center">
        <h1 className="text-xl font-semibold">No access</h1>
        <p className="text-muted">Your account doesn&rsquo;t have access to the admin. Ask the hotel admin to check your invitation.</p>
        <Btn variant="dark" onClick={() => void signOut().then(() => router.replace("/admin/login"))}>
          Sign out
        </Btn>
      </div>
    </main>
  );
}

function Frame({ me, children }: { me: Me; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const recordSignIn = useMutation(api.users.recordSignIn);

  // "Last sign-in" on the Staff page: once per browser session.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("selems_seen")) return;
      sessionStorage.setItem("selems_seen", "1");
    } catch {
      /* storage blocked: record anyway */
    }
    void recordSignIn({}).catch(() => undefined);
  }, [recordSignIn]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-dvh">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:px-4 focus:py-3">
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 overflow-y-auto bg-ink lg:block">
        <Sidebar me={me} onSearch={() => setSearchOpen(true)} />
      </aside>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent
          side="left"
          className="w-72 border-0 bg-ink p-0 text-[#C9D3D9]"
          onClick={(e) => (e.target as HTMLElement).closest("a") && setMenuOpen(false)}
        >
          <SheetTitle className="sr-only">Admin menu</SheetTitle>
          <Sidebar me={me} onSearch={() => { setMenuOpen(false); setSearchOpen(true); }} />
        </SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-line bg-ink px-2 text-white lg:hidden">
          <Btn variant="ghost" className="text-white hover:bg-white/10" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <MenuIcon />
          </Btn>
          <span className="font-display text-xl">Selems</span>
          <Btn variant="ghost" className="ml-auto text-white hover:bg-white/10" aria-label="Search bookings" onClick={() => setSearchOpen(true)}>
            <SearchIcon />
          </Btn>
        </div>
        <main id="admin-main" className="min-w-0 flex-1">
          {children}
        </main>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

function Sidebar({ me, onSearch }: { me: Me; onSearch: () => void }) {
  const pathname = usePathname();
  const counts = useQuery(api.admin.dashboard.navCounts, {});
  const { signOut } = useAuthActions();
  const router = useRouter();
  const initials = me.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const active = (item: NavItem) =>
    item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.match ?? item.href);

  return (
    <div className="flex min-h-full flex-col gap-6 px-4 py-6 text-[#C9D3D9]">
      <Link href="/admin" className="px-3 font-display text-2xl text-stone no-underline hover:text-white">
        Selems <span className="block font-sans text-[11px] font-semibold tracking-[0.18em] text-amber-tint uppercase">Admin</span>
      </Link>
      <button
        type="button"
        onClick={onSearch}
        className="flex min-h-11 items-center gap-2.5 rounded-md border border-white/15 px-3 text-left text-sm text-[#C9D3D9] hover:bg-white/5"
      >
        <SearchIcon className="size-4" aria-hidden />
        Find a booking
        <kbd className="ml-auto rounded border border-white/20 px-1.5 text-[11px] text-[#9FB0BB]">Ctrl K</kbd>
      </button>
      <nav aria-label="Admin" className="flex flex-col gap-0.5">
        {NAV.map((section) => {
          const items = section.items.filter((i) => !i.adminOnly || me.role === "admin");
          if (!items.length) return null;
          return (
            <div key={section.group ?? "main"} className="flex flex-col gap-0.5">
              {section.group ? (
                <p className="m-0 mt-3 mb-1.5 px-3 text-[11px] tracking-[0.16em] text-[#9FB0BB] uppercase">{section.group}</p>
              ) : null}
              {items.map((item) => {
                const on = active(item);
                const n = item.badge ? counts?.[item.badge] : 0;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-md px-3 text-[14.5px] font-medium text-[#C9D3D9] no-underline hover:bg-white/5 hover:text-white",
                      on && "bg-[#24333F] text-white shadow-[inset_3px_0_0_var(--color-amber-tint)]",
                    )}
                  >
                    <item.icon className="size-[18px] shrink-0" aria-hidden />
                    {item.label}
                    {n ? (
                      <span className="ml-auto rounded-full bg-amber-tint px-2 text-xs font-bold text-ink tabular-nums">
                        {n}
                        <span className="sr-only"> {item.badge === "attention" ? "need attention" : "new"}</span>
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="mt-auto flex items-center gap-2.5 text-[13px]">
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-slate font-semibold text-white" aria-hidden>
          {initials}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-white">{me.name}</span>
          <span className="text-[#9FB0BB]">{me.role === "admin" ? "Admin" : "Front desk"}</span>
        </span>
        <button
          type="button"
          aria-label="Sign out"
          title="Sign out"
          className="inline-flex size-11 items-center justify-center rounded-md hover:bg-white/10"
          onClick={() => void signOut().then(() => router.replace("/admin/login"))}
        >
          <LogOutIcon className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [q, setQ] = useState("");
  const results = useQuery(api.admin.reservations.quickSearch, open && q.trim().length >= 2 ? { q } : "skip");
  const router = useRouter();
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title="Find a booking" description="Search by guest name, phone or booking reference">
      <Command shouldFilter={false}>
      <CommandInput placeholder="Guest name, phone or SLM-26-0001" value={q} onValueChange={setQ} />
      <CommandList>
        {q.trim().length >= 2 ? <CommandEmpty>{results === undefined ? "Searching…" : "No bookings found."}</CommandEmpty> : null}
        {results?.length ? (
          <CommandGroup heading="Bookings">
            {results.map((r) => (
              <CommandItem
                key={r.id}
                value={r.id}
                onSelect={() => {
                  onOpenChange(false);
                  setQ("");
                  router.push(`/admin/reservations/${r.id}`);
                }}
                className="flex min-h-11 items-center gap-3"
              >
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{r.guest}</strong>
                  <span className="text-xs text-muted">
                    {r.ref} · {r.roomType} {r.roomNumber} · {formatDateShort(r.checkIn)} – {formatDateShort(r.checkOut)}
                  </span>
                </span>
                <Pill tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Pill>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
      </Command>
    </CommandDialog>
  );
}

/** Wraps admin-only screens: staff see a short explanation (the server refuses anyway). */
export function AdminOnly({ children }: { children: ReactNode }) {
  const me = useMe();
  if (me.role !== "admin") {
    return (
      <div className="p-8">
        <div className="max-w-lg rounded-lg border border-line bg-white p-6">
          <h1 className="text-xl font-semibold">Admins only</h1>
          <p className="m-0 text-muted">Only a hotel admin can open this page. Ask the manager if you need a change made here.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
