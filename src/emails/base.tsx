import * as React from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";

interface BaseEmailProps {
  preview: string;
  greeting: string;
  body: React.ReactNode;
  ctaText: string;
  ctaHref: string;
  /** Optional block of detail rows rendered above the CTA */
  details?: React.ReactNode;
}

export function BaseEmail({ preview, greeting, body, ctaText, ctaHref, details }: BaseEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={appName}>RugbyTrack</Text>
          <Text style={text}>{greeting}</Text>
          <Text style={text}>{body}</Text>
          {details && <div style={card}>{details}</div>}
          <Text style={text}>
            <Link href={ctaHref} style={link}>{ctaText}</Link>
          </Text>
          <Text style={footer}>RugbyTrack — Gestión de rugby amateur</Text>
        </Container>
      </Body>
    </Html>
  );
}

const main: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};
const container: React.CSSProperties = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "24px 48px 40px",
  maxWidth: "560px",
};
const appName: React.CSSProperties = {
  color: "#808CFD",
  fontSize: "13px",
  fontWeight: "bold",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  margin: "0 0 20px",
};
const text: React.CSSProperties = {
  color: "#333333",
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 14px",
};
const card: React.CSSProperties = {
  backgroundColor: "#f4f4f5",
  border: "1px solid #e4e4e7",
  borderRadius: "6px",
  padding: "12px 16px",
  margin: "0 0 14px",
};
export const detailRow: React.CSSProperties = {
  color: "#444444",
  fontSize: "14px",
  lineHeight: "22px",
  margin: "2px 0",
};
const link: React.CSSProperties = {
  color: "#808CFD",
  textDecoration: "underline",
  fontWeight: "bold",
};
const footer: React.CSSProperties = {
  color: "#9ca3af",
  fontSize: "11px",
  lineHeight: "16px",
  marginTop: "32px",
  borderTop: "1px solid #e4e4e7",
  paddingTop: "16px",
};
