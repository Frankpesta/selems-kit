import type { Metadata } from "next";
import { RoomTypeEditor } from "@/components/admin/rooms/RoomTypeEditor";

export const metadata: Metadata = { title: "Edit room type" };

export default function RoomTypePage() {
  return <RoomTypeEditor />;
}
