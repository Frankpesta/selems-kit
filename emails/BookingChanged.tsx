import { Link, Text } from "react-email";
import { Details, EmailLayout, c, eyebrow, heading, small, text } from "./Layout";
import type { BookingEmailModel } from "./model";

/** Staff changed the dates or room type of a booking. */
export function BookingChanged({ m }: { m: BookingEmailModel }) {
  return (
    <EmailLayout preview={`Your booking ${m.ref} has been updated: ${m.checkIn} to ${m.checkOut}.`} hotel={m.hotel}>
      <Text style={eyebrow}>Booking updated · {m.ref}</Text>
      <Text style={heading}>Your booking has changed, {m.guestFirstName}.</Text>
      <Text style={text}>
        We&rsquo;ve updated your booking. Here are the new details. You still pay at the front desk when you arrive.
      </Text>
      <Details
        rows={[
          ["Reference", m.ref],
          ["Room", m.roomName],
          ["Check in", m.checkInTime ? `${m.checkIn}, from ${m.checkInTime}` : m.checkIn],
          ["Check out", m.checkOutTime ? `${m.checkOut}, by ${m.checkOutTime}` : m.checkOut],
          ["Length of stay", m.nights],
          ["Guests", m.party],
          ...m.priceLines.map((l): [string, string] => [l.label, l.amount]),
          ["Total due at the hotel", m.totalDue],
        ]}
      />
      <Text style={small}>
        Didn&rsquo;t ask for this change? Call{" "}
        <Link href={m.hotel.phoneHref} style={{ color: c.amber }}>
          {m.hotel.phone}
        </Link>{" "}
        and quote {m.ref}. The link in your confirmation email still shows your booking.
      </Text>
    </EmailLayout>
  );
}
