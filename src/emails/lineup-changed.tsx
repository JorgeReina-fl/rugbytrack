import * as React from "react";
import { BaseEmail, detailRow } from "./base";
import { Text } from "@react-email/components";

interface LineupChangedEmailProps {
  userName: string;
  eventTitle: string;
  /** Resumen del cambio, el mismo que el asunto */
  headline: string;
  eventLink: string;
}

export const LineupChangedEmail = ({
  userName = "Jugador",
  eventTitle = "Partido",
  headline = "Tu convocatoria ha cambiado",
  eventLink = "http://localhost:3000",
}: LineupChangedEmailProps) => (
  <BaseEmail
    preview={headline}
    greeting={`Hola ${userName},`}
    body={headline}
    details={<Text style={detailRow}><strong>Evento:</strong> {eventTitle}</Text>}
    ctaText="Ver el partido →"
    ctaHref={eventLink}
  />
);
