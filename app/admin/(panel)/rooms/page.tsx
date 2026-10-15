import type { Metadata } from "next";
import { RoomTypesView } from "@/components/admin/rooms/RoomTypesView";

export const metadata: Metadata = { title: "Rooms & rates" };

export default function RoomsPage() {
  return <RoomTypesView />;
}
