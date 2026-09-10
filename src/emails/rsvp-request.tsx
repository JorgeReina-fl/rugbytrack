import * as React from "react";
import { BaseEmail, detailRow } from "./base";
import { Text } from "@react-email/components";

interface RsvpRequestEmailProps {
  userName: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  rsvpLink: string;
}

export const RsvpRequestEmail = ({
  userName = "Jugador",
  eventTitle = "Evento",
  eventDate = "Próximamente",
  eventLocation = "Por confirmar",
  rsvpLink = "http://localhost:3000",
}: RsvpRequestEmailProps) => (
  <BaseEmail
    preview={`Convocatoria: ${eventTitle} — confirma tu asistencia`}
    greeting={`Hola ${userName},`}
    body="Has sido convocado al siguiente evento. Confirma tu asistencia antes de la fecha límite:"
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
