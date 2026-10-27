import * as React from "react";
import { BaseEmail, detailRow } from "./base";
import { Text } from "@react-email/components";

interface RpeLinkEmailProps {
  userName: string;
  eventTitle: string;
  eventType: string;
  eventDate: string;
  deadline: string;
  rpeLink: string;
}

export const RpeLinkEmail = ({
  userName = "Jugador",
  eventTitle = "Evento",
  eventType = "Evento",
  eventDate = "",
  deadline = "",
  rpeLink = "http://localhost:3000",
}: RpeLinkEmailProps) => (
  <BaseEmail
    preview={`Registra tu RPE: ${eventTitle}`}
    greeting={`Hola ${userName},`}
    body="Registra el esfuerzo percibido (RPE) y la duración de la sesión:"
    details={
      <>
        <Text style={detailRow}><strong>Evento:</strong> {eventTitle}</Text>
        <Text style={detailRow}><strong>Tipo:</strong> {eventType}</Text>
        <Text style={detailRow}><strong>Fecha:</strong> {eventDate}</Text>
        <Text style={detailRow}><strong>Disponible hasta el</strong> {deadline}</Text>
      </>
    }
    ctaText="Registrar mi RPE →"
    ctaHref={rpeLink}
  />
);
