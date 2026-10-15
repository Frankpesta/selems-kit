import type { ReactNode } from "react";
import { Body, Container, Head, Hr, Html, Img, Link, Preview, Section, Text } from "react-email";
import type { HotelContact } from "./model";

// Brand tokens (docs/02), inlined because email clients ignore stylesheets.
export const c = {
  ink: "#17222D",
  ink2: "#0F171E",
  stone: "#F3F4F2",
  paper: "#FFFFFF",
  line: "#DCE1E1",
  muted: "#5E6E79",
  body: "#3B4B57",
  amber: "#A4561B",
};
export const sans = "'Instrument Sans', -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
export const serif = "'Cormorant Garamond', Garamond, Georgia, serif";

export const text = { fontFamily: sans, fontSize: "16px", lineHeight: "1.6", color: c.ink, margin: "0 0 16px" };
export const small = { ...text, fontSize: "14px", color: c.body };
export const heading = {
  fontFamily: serif,
  fontWeight: 600,
  fontSize: "32px",
  lineHeight: "1.15",
  color: c.ink,
  margin: "0 0 16px",
};
export const eyebrow = {
  fontFamily: sans,
  fontSize: "12px",
  letterSpacing: "0.18em",
  textTransform: "uppercase" as const,
  fontWeight: 600,
  color: c.muted,
  margin: "0 0 8px",
};
export const button = {
  backgroundColor: c.amber,
  color: "#FFFFFF",
  fontFamily: sans,
  fontWeight: 600,
  fontSize: "15px",
  textDecoration: "none",
  padding: "14px 24px",
  borderRadius: "2px",
  display: "inline-block",
};

export function EmailLayout({
  preview,
  hotel,
  children,
}: {
  preview: string;
  hotel: HotelContact;
  children: ReactNode;
}) {
  return (
    <Html lang="en-NG">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: c.stone, margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: c.paper }}>
          <Section style={{ backgroundColor: c.ink2, padding: "24px 32px" }}>
            <Img src={hotel.logoUrl} alt={hotel.name} width="200" height="48" style={{ display: "block" }} />
          </Section>
          <Section style={{ padding: "32px" }}>{children}</Section>
          <Hr style={{ borderColor: c.line, margin: 0 }} />
          <Section style={{ padding: "24px 32px" }}>
            <Text style={{ ...small, margin: "0 0 4px", fontWeight: 600, color: c.ink }}>{hotel.name}</Text>
            <Text style={{ ...small, margin: "0 0 4px" }}>
              <Link href={hotel.mapsUrl} style={{ color: c.body }}>
                {hotel.address}
              </Link>
            </Text>
            <Text style={{ ...small, margin: 0 }}>
              <Link href={hotel.phoneHref} style={{ color: c.amber }}>
                {hotel.phone}
              </Link>
              {hotel.whatsappHref ? (
                <>
                  {" · "}
                  <Link href={hotel.whatsappHref} style={{ color: c.amber }}>
                    WhatsApp
                  </Link>
                </>
              ) : null}
              {" · "}
              <Link href={`mailto:${hotel.bookingEmail}`} style={{ color: c.amber }}>
                {hotel.bookingEmail}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Two-column detail rows: label left, value right. */
export function Details({ rows }: { rows: [string, string | null | undefined][] }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ borderTop: `1px solid ${c.line}`, margin: "0 0 24px" }}>
      <tbody>
        {rows
          .filter((r): r is [string, string] => !!r[1])
          .map(([label, value]) => (
            <tr key={label}>
              <td style={{ ...small, margin: 0, padding: "10px 0", borderBottom: `1px solid ${c.line}`, color: c.muted, width: "40%", verticalAlign: "top" }}>
                {label}
              </td>
              <td style={{ ...small, margin: 0, padding: "10px 0", borderBottom: `1px solid ${c.line}`, color: c.ink, textAlign: "right", verticalAlign: "top" }}>
                {value}
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}
