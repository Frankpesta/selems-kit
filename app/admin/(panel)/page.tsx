import type { Metadata } from "next";
import { TodayView } from "@/components/admin/today/TodayView";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return <TodayView />;
}
