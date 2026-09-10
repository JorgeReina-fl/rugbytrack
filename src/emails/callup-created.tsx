import * as React from "react";
import { BaseEmail, detailRow } from "./base";
import { Text } from "@react-email/components";

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
  <BaseEmail
    preview={`Has sido convocado para ${eventTitle}`}
    greeting={`Hola ${userName},`}
    body="Has sido convocado para el siguiente evento:"
    details={
      <>
        <Text style={detailRow}><strong>Evento:</strong> {eventTitle}</Text>
        <Text style={detailRow}><strong>Fecha:</strong> {eventDate}</Text>
        <Text style={detailRow}><strong>Lugar:</strong> {eventLocation}</Text>
      </>
    }
    ctaText="Confirmar asistencia →"
    ctaHref={rsvpLink}
  />
);
