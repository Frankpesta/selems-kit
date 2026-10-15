import { Button, Section, Text } from "react-email";
import { EmailLayout, button, eyebrow, heading, small, text } from "./Layout";
import type { BookingEmailModel } from "./model";

/** The day after check-out (cron, docs/04). Links to the hotel's Google review page. */
export function ReviewRequest({ m, reviewUrl }: { m: BookingEmailModel; reviewUrl: string }) {
  return (
    <EmailLayout preview={`Thank you for staying with us, ${m.guestFirstName}.`} hotel={m.hotel}>
      <Text style={eyebrow}>Thank you · {m.ref}</Text>
      <Text style={heading}>How was your stay, {m.guestFirstName}?</Text>
      <Text style={text}>
        Thank you for staying at {m.hotel.name}. If you have a minute, a short review on Google helps other travellers
        find us, and tells us what to keep doing.
      </Text>
      <Section style={{ margin: "0 0 24px" }}>
        <Button href={reviewUrl} style={button}>
          Write a Google review
        </Button>
      </Section>
      <Text style={small}>
        Something we should have done better? Reply to this email and the manager will read it. We won&rsquo;t ask
        again for this stay.
      </Text>
    </EmailLayout>
  );
}
