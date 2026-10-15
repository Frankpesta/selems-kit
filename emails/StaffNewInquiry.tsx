import { Body, Button, Container, Head, Html, Img, Preview, Section, Text } from "react-email";
import { Details, button, c, eyebrow, heading, text } from "./Layout";

export type InquiryEmailModel = {
  hotelName: string;
  logoUrl: string;
  adminUrl: string;
  subject: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  receivedAt: string;
};

export function StaffNewInquiry({ m }: { m: InquiryEmailModel }) {
  return (
    <Html lang="en-NG">
      <Head />
      <Preview>{`New message from ${m.name}: ${m.subject}`}</Preview>
      <Body style={{ backgroundColor: c.stone, margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: c.paper }}>
          <Section style={{ backgroundColor: c.ink2, padding: "24px 32px" }}>
            <Img src={m.logoUrl} alt={m.hotelName} width="200" height="48" />
          </Section>
          <Section style={{ padding: "32px" }}>
            <Text style={eyebrow}>New website message · {m.subject}</Text>
            <Text style={heading}>{m.name}</Text>
            <Text style={{ ...text, whiteSpace: "pre-wrap" }}>{m.message}</Text>
            <Details
              rows={[
                ["Email", m.email],
                ["Phone", m.phone],
                ["Received", m.receivedAt],
              ]}
            />
            <Button href={m.adminUrl} style={button}>
              Open the inbox
            </Button>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
