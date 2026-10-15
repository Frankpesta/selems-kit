import type { ReactNode } from "react";
import { Body, Button, Container, Head, Html, Img, Preview, Section, Text } from "react-email";
import { button, c, eyebrow, heading, small, text } from "./Layout";

// Emails to staff: invitations, one-time codes and front-desk alerts.

export type StaffShell = { hotelName: string; logoUrl: string };

function StaffLayout({ s, preview, children }: { s: StaffShell; preview: string; children: ReactNode }) {
  return (
    <Html lang="en-NG">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={{ backgroundColor: c.stone, margin: 0, padding: "24px 0" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", backgroundColor: c.paper }}>
          <Section style={{ backgroundColor: c.ink2, padding: "24px 32px" }}>
            <Img src={s.logoUrl} alt={s.hotelName} width="200" height="48" />
          </Section>
          <Section style={{ padding: "32px" }}>{children}</Section>
        </Container>
      </Body>
    </Html>
  );
}

export function StaffInvite(props: {
  s: StaffShell;
  name: string;
  role: "admin" | "staff";
  url: string;
  invitedBy: string | null;
  expires: string;
}) {
  const { s, name, role, url, invitedBy, expires } = props;
  return (
    <StaffLayout s={s} preview={`You're invited to the ${s.hotelName} admin`}>
      <Text style={eyebrow}>Staff account</Text>
      <Text style={heading}>Welcome, {name}.</Text>
      <Text style={text}>
        {invitedBy ? `${invitedBy} has invited you` : "You've been invited"} to the {s.hotelName} admin as{" "}
        {role === "admin" ? "an admin" : "front-desk staff"}. Choose a password for this email address; we&rsquo;ll
        send a code to this inbox to confirm it&rsquo;s you.
      </Text>
      <Section style={{ margin: "0 0 24px" }}>
        <Button href={url} style={button}>
          Create your account
        </Button>
      </Section>
      <Text style={small}>This invitation expires on {expires}. If you weren&rsquo;t expecting it, ignore this email.</Text>
    </StaffLayout>
  );
}

export function AuthCode({ s, code, purpose }: { s: StaffShell; code: string; purpose: "verify" | "reset" }) {
  const reset = purpose === "reset";
  return (
    <StaffLayout s={s} preview={`Your ${s.hotelName} code: ${code}`}>
      <Text style={eyebrow}>{reset ? "Password reset" : "Confirm your email"}</Text>
      <Text style={heading}>Your code is {code}</Text>
      <Text style={text}>
        {reset ? "Enter this code with your new password to reset it." : "Enter this code to finish creating your staff account."}{" "}
        It works for 15 minutes.
      </Text>
      <Text style={small}>Didn&rsquo;t ask for this? Ignore this email: nothing changes without the code.</Text>
    </StaffLayout>
  );
}

export function StaffAlert({ s, title, lines, url, action }: { s: StaffShell; title: string; lines: string[]; url: string; action: string }) {
  return (
    <StaffLayout s={s} preview={title}>
      <Text style={eyebrow}>Front desk</Text>
      <Text style={{ ...heading, fontSize: "26px" }}>{title}</Text>
      {lines.map((l) => (
        <Text key={l} style={text}>
          {l}
        </Text>
      ))}
      <Section>
        <Button href={url} style={button}>
          {action}
        </Button>
      </Section>
    </StaffLayout>
  );
}
