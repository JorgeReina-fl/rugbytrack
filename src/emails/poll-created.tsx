import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

interface PollCreatedEmailProps {
  userName: string;
  teamName: string;
  pollTitle: string;
  pollLink: string;
}

export const PollCreatedEmail = ({
  userName = "Miembro",
  teamName = "Tu equipo",
  pollTitle = "Nueva encuesta",
  pollLink = "http://localhost:3000",
}: PollCreatedEmailProps) => (
  <Html>
    <Head />
    <Preview>Nueva encuesta en {teamName}: {pollTitle}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Nueva encuesta</Heading>
        <Text style={text}>Hola {userName},</Text>
        <Text style={text}>
          Se ha publicado una nueva encuesta en <strong>{teamName}</strong>:
        </Text>
        <Section style={card}>
          <Text style={cardText}><strong>{pollTitle}</strong></Text>
        </Section>
        <Text style={text}>Accede para votar:</Text>
        <Section style={btnContainer}>
          <Button style={button} href={pollLink}>
            Ver encuesta
          </Button>
        </Section>
        <Text style={footer}>RugbyTrack — Gestión de rugby amateur</Text>
      </Container>
    </Body>
  </Html>
);

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};
const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
};
const h1 = {
  color: "#333",
  fontSize: "24px",
  fontWeight: "bold",
  textAlign: "center" as const,
  margin: "30px 0",
};
const text = {
  color: "#333",
  fontSize: "16px",
  lineHeight: "26px",
  padding: "0 48px",
};
const card = {
  margin: "20px 48px",
  padding: "20px",
  borderRadius: "8px",
  backgroundColor: "#f4f4f5",
  border: "1px solid #e4e4e7",
};
const cardText = {
  color: "#444",
  fontSize: "15px",
  lineHeight: "22px",
  margin: "5px 0",
};
const btnContainer = {
  textAlign: "center" as const,
  margin: "30px 0",
};
const button = {
  backgroundColor: "#18181b",
  borderRadius: "5px",
  color: "#fff",
  fontSize: "16px",
  fontWeight: "bold",
  textDecoration: "none",
  textAlign: "center" as const,
  display: "inline-block",
  padding: "12px 24px",
};
const footer = {
  color: "#8898aa",
  fontSize: "12px",
  lineHeight: "16px",
  textAlign: "center" as const,
  marginTop: "50px",
};
