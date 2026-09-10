import * as React from "react";
import { BaseEmail, detailRow } from "./base";
import { Text } from "@react-email/components";

interface RsvpReminderEmailProps {
  userName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  rsvpLink: string;
}

export const RsvpReminderEmail = ({
  userName = "Jugador",
  eventTitle = "Evento",
  eventDate = "Mañana",
  eventLocation = "Por confirmar",
  rsvpLink = "http://localhost:3000",
}: RsvpReminderEmailProps) => (
  <BaseEmail
    preview={`Recuerda confirmar tu asistencia — ${eventTitle} es mañana`}
    greeting={`Hola ${userName},`}
    body="Mañana tienes un evento y aún no has confirmado tu asistencia. El entrenador necesita saber si cuentan contigo:"
    details={
      <>
        <Text style={detailRow}><strong>Evento:</strong> {eventTitle}</Text>
        <Text style={detailRow}><strong>Fecha:</strong> {eventDate}</Text>
        <Text style={detailRow}><strong>Lugar:</strong> {eventLocation}</Text>
      </>
    }
    ctaText="Confirmar / declinar asistencia →"
    ctaHref={rsvpLink}
  />
);
