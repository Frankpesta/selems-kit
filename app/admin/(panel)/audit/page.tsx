import type { Metadata } from "next";
import { AuditView } from "@/components/admin/AuditView";

export const metadata: Metadata = { title: "Activity log" };

export default function Page() {
  return <AuditView />;
}
