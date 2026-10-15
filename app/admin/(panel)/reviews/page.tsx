import type { Metadata } from "next";
import { ReviewsView } from "@/components/admin/lists/ReviewsView";

export const metadata: Metadata = { title: "Reviews" };

export default function Page() {
  return <ReviewsView />;
}
