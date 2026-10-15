import { Button, Section, Text } from "react-email";
import { Details, EmailLayout, button, eyebrow, heading, text } from "./Layout";
import type { BookingEmailModel } from "./model";

export function StaffNewBooking({ m }: { m: BookingEmailModel }) {
  return (
    <EmailLayout preview={`New website booking ${m.ref}: ${m.roomName}, ${m.checkIn}.`} hotel={m.hotel}>
      <Text style={eyebrow}>New website booking</Text>
      <Text style={heading}>
        {m.guestFullName} · {m.roomName}
      </Text>
      <Text style={text}>
        Booked online, pay at the hotel. The room has been assigned automatically; you can move it on the
        Availability screen.
      </Text>
      <Details
        rows={[
          ["Reference", m.ref],
          ["Room", m.roomName],
          ["Check in", m.checkIn],
          ["Check out", m.checkOut],
          ["Length of stay", m.nights],
          ["Guests", m.party],
          ["Offer", m.offerTitle],
          ["Total due", m.totalDue],
          ["Arriving", m.arrivalWindow],
          ["Requests", m.specialRequests],
          ["Phone", m.guestPhone],
          ["Email", m.guestEmail],
        ]}
      />
      <Section>
        <Button href={m.adminUrl} style={button}>
          Open in admin
        </Button>
      </Section>
    </EmailLayout>
  );
}
