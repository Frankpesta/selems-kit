import { Button, Link, Section, Text } from "react-email";
import { Details, EmailLayout, button, c, eyebrow, heading, text } from "./Layout";
import type { BookingEmailModel } from "./model";

export function BookingCancelled({ m, audience }: { m: BookingEmailModel; audience: "guest" | "staff" }) {
  const guest = audience === "guest";
  return (
    <EmailLayout preview={`Booking ${m.ref} has been cancelled.`} hotel={m.hotel}>
      <Text style={eyebrow}>Booking cancelled · {m.ref}</Text>
      <Text style={heading}>
        {guest ? `Your booking is cancelled, ${m.guestFirstName}.` : `${m.guestFullName} cancelled ${m.ref}`}
      </Text>
      <Text style={text}>
        {guest
          ? "We've cancelled this booking and released the room. There is nothing to pay."
          : "The room has been released for these nights."}
      </Text>
      <Details
        rows={[
          ["Reference", m.ref],
          ["Room", m.roomName],
          ["Check in", m.checkIn],
          ["Check out", m.checkOut],
          ["Guests", m.party],
          ...(guest ? [] : ([["Phone", m.guestPhone], ["Email", m.guestEmail]] as [string, string][])),
        ]}
      />
      {guest ? (
        <>
          <Section style={{ margin: "0 0 24px" }}>
            <Button href={`${m.hotel.siteUrl}/book`} style={button}>
              Book another stay
            </Button>
          </Section>
          <Text style={text}>
            Didn&rsquo;t mean to cancel? Call{" "}
            <Link href={m.hotel.phoneHref} style={{ color: c.amber }}>
              {m.hotel.phone}
            </Link>{" "}
            and we&rsquo;ll help if the room is still free.
          </Text>
        </>
      ) : (
        <Section>
          <Button href={m.adminUrl} style={button}>
            Open in admin
          </Button>
        </Section>
      )}
    </EmailLayout>
  );
}
