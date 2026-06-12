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

interface CallupCreatedEmailProps {
  userName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  rsvpLink: string;
}

export const CallupCreatedEmail = ({
  userName = "Jugador",
  eventTitle = "Entrenamiento",
  eventDate = "Hoy",
  eventLocation = "Campo de Rugby",
  rsvpLink = "http://localhost:3000",
}: CallupCreatedEmailProps) => (
  <Html>
    <Head />
    <Preview>Has sido convocado para {eventTitle}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>¡Nueva Convocatoria!</Heading>
        <Text style={text}>Hola {userName},</Text>
        <Text style={text}>
          Has sido convocado para participar en el siguiente evento:
        </Text>
        <Section style={card}>
          <Text style={cardText}><strong>Evento:</strong> {eventTitle}</Text>
          <Text style={cardText}><strong>Fecha:</strong> {eventDate}</Text>
          <Text style={cardText}><strong>Lugar:</strong> {eventLocation}</Text>
        </Section>
        <Text style={text}>
          Por favor, confirma tu asistencia antes de la fecha límite ingresando al siguiente enlace:
        </Text>
        <Section style={btnContainer}>
          <Button style={button} href={rsvpLink}>
            Confirmar Asistencia
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
