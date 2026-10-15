import { getRoom, getRooms } from "@/lib/data";
import { formatNaira } from "@/lib/money";
import { OG_SIZE, shareImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Room at Selems Exclusive Hotel & Suites, Akure";

export async function generateStaticParams() {
  return (await getRooms()).map((r) => ({ slug: r.slug }));
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getRoom(slug);
  const room = data && "room" in data ? data.room : null;
  return shareImage({
    eyebrow: room?.category === "suite" ? "Suite in Akure" : "Room in Akure",
    title: room?.name ?? "Rooms and suites",
    detail: room ? `${formatNaira(room.baseRate)} / night · pay at the hotel` : "Ijapo Extension, Akure",
    photo: room?.images[0]?.url ?? "/images/selems-hotel-akure-exterior-front.jpg",
  });
}
