import { Button, Link, Section, Text } from "react-email";
import { Details, EmailLayout, button, c, eyebrow, heading, small, text } from "./Layout";
import type { BookingEmailModel } from "./model";

export function BookingConfirmation({ m }: { m: BookingEmailModel }) {
  return (
    <EmailLayout preview={`Your ${m.roomName} is reserved, ${m.checkIn} to ${m.checkOut}. Ref ${m.ref}.`} hotel={m.hotel}>
      <Text style={eyebrow}>Booking confirmed · {m.ref}</Text>
      <Text style={heading}>You&rsquo;re booked, {m.guestFirstName}.</Text>
      <Text style={text}>
        Your room is reserved. There is nothing to pay now: you pay at the front desk when you arrive, by cash,
        transfer or card.
      </Text>

      <Details
        rows={[
          ["Reference", m.ref],
          ["Room", m.roomName],
          ["Check in", m.checkInTime ? `${m.checkIn}, from ${m.checkInTime}` : m.checkIn],
          ["Check out", m.checkOutTime ? `${m.checkOut}, by ${m.checkOutTime}` : m.checkOut],
          ["Length of stay", m.nights],
          ["Guests", m.party],
          ["Offer", m.offerTitle],
          ...m.priceLines.map((l): [string, string] => [l.label, l.amount]),
          ["Total due at the hotel", m.totalDue],
          ["Arriving", m.arrivalWindow],
          ["Your requests", m.specialRequests],
        ]}
      />

      {m.manageUrl ? (
        <Section style={{ margin: "0 0 24px" }}>
          <Button href={m.manageUrl} style={button}>
            Manage or cancel your booking
          </Button>
        </Section>
      ) : null}

      {m.cancellationPolicy ? (
        <Text style={small}>
          <strong style={{ color: c.ink }}>Cancellation policy.</strong> {m.cancellationPolicy}
        </Text>
      ) : null}

      <Text style={small}>
        <strong style={{ color: c.ink }}>Finding us.</strong> {m.hotel.address}.{" "}
        <Link href={m.hotel.mapsUrl} style={{ color: c.amber }}>
          Open in Google Maps
        </Link>
        . The front office is open 24 hours: call{" "}
        <Link href={m.hotel.phoneHref} style={{ color: c.amber }}>
          {m.hotel.phone}
        </Link>
        {m.hotel.whatsappHref ? (
          <>
            {" "}or{" "}
            <Link href={m.hotel.whatsappHref} style={{ color: c.amber }}>
              WhatsApp us
            </Link>
          </>
        ) : null}{" "}
        if you need anything before you arrive.
      </Text>
    </EmailLayout>
  );
}
