import { AdminShell } from "@/components/admin/AdminShell";

// Signed-in admin area. proxy.ts redirects signed-out visitors before this
// renders; AdminShell also checks the staff profile is active.
export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
