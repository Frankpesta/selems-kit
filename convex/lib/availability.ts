import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { eachNight } from "../../lib/dates";

// Availability rules (docs/04). A room is free for a stay when it is active and
// has no occupancy row (booking or block) on any night of [checkIn, checkOut).

/** Rooms taken on any of the given nights. Optionally ignore one booking's own nights (staff moves). */
export async function occupiedRoomIds(
  ctx: QueryCtx,
  nights: string[],
  ignoreBookingId?: Id<"bookings">,
): Promise<Set<Id<"rooms">>> {
  const taken = new Set<Id<"rooms">>();
  for (const night of nights) {
    const rows = await ctx.db
      .query("occupancy")
      .withIndex("by_date", (q) => q.eq("date", night))
      .collect();
    for (const row of rows) {
      if (ignoreBookingId && row.bookingId === ignoreBookingId) continue;
      taken.add(row.roomId);
    }
  }
  return taken;
}

/** Active rooms of a type with no occupancy across the stay, sorted by room number. */
export async function freeRoomsOfType(
  ctx: QueryCtx,
  roomTypeId: Id<"roomTypes">,
  checkIn: string,
  checkOut: string,
  ignoreBookingId?: Id<"bookings">,
): Promise<Doc<"rooms">[]> {
  const rooms = await ctx.db
    .query("rooms")
    .withIndex("by_type", (q) => q.eq("roomTypeId", roomTypeId))
    .collect();
  const active = rooms.filter((r) => r.status === "active");
  if (active.length === 0) return [];
  const taken = await occupiedRoomIds(ctx, eachNight(checkIn, checkOut), ignoreBookingId);
  return active
    .filter((r) => !taken.has(r._id))
    .sort((a, b) => a.number.localeCompare(b.number, "en", { numeric: true }));
}

/** Whether one specific room is free for a stay (staff picks a room, or moves a booking). */
export async function isRoomFree(
  ctx: QueryCtx,
  roomId: Id<"rooms">,
  checkIn: string,
  checkOut: string,
  ignoreBookingId?: Id<"bookings">,
): Promise<boolean> {
  const room = await ctx.db.get(roomId);
  if (!room || room.status !== "active") return false;
  for (const night of eachNight(checkIn, checkOut)) {
    const row = await ctx.db
      .query("occupancy")
      .withIndex("by_room_date", (q) => q.eq("roomId", roomId).eq("date", night))
      .first();
    if (row && !(ignoreBookingId && row.bookingId === ignoreBookingId)) return false;
  }
  return true;
}

/** Free-room count shown to guests is capped at 5 ("Only 2 left" when ≤ 2). */
export const displayAvailable = (free: number): number => Math.min(free, 5);
