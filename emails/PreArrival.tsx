import { Button, Link, Section, Text } from "react-email";
import { Details, EmailLayout, button, c, eyebrow, heading, small, text } from "./Layout";
import type { BookingEmailModel } from "./model";

/** The day before arrival (cron, docs/04). */
export function PreArrival({ m }: { m: BookingEmailModel }) {
  return (
    <EmailLayout preview={`See you tomorrow: ${m.roomName}, ${m.checkIn}. Ref ${m.ref}.`} hotel={m.hotel}>
      <Text style={eyebrow}>Arriving tomorrow · {m.ref}</Text>
      <Text style={heading}>See you tomorrow, {m.guestFirstName}.</Text>
      <Text style={text}>
        Your {m.roomName} is ready for you. Bring a photo ID for the guest named on the booking. You pay at the front
        desk when you arrive.
      </Text>
      <Details
        rows={[
          ["Reference", m.ref],
          ["Check in", m.checkInTime ? `${m.checkIn}, from ${m.checkInTime}` : m.checkIn],
          ["Check out", m.checkOutTime ? `${m.checkOut}, by ${m.checkOutTime}` : m.checkOut],
          ["Guests", m.party],
          ["Total due at the hotel", m.totalDue],
        ]}
      />
      <Section style={{ margin: "0 0 24px" }}>
        <Button href={m.hotel.mapsUrl} style={button}>
          Directions in Google Maps
        </Button>
      </Section>
      <Text style={small}>
        Running late or need to change something? Call{" "}
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
        and quote {m.ref}.
      </Text>
    </EmailLayout>
  );
}
