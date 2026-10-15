import type { Metadata } from "next";
import { StaffView } from "@/components/admin/staff/StaffView";

export const metadata: Metadata = { title: "Staff" };

export default function Page() {
  return <StaffView />;
}
