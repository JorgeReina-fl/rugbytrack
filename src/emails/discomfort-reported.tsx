import * as React from "react";
import { BaseEmail } from "./base";

interface DiscomfortReportedEmailProps {
  eventTitle: string;
  eventLink: string;
}

// Dato de salud: el aviso NO incluye jugador, zona, intensidad ni nota.
export const DiscomfortReportedEmail = ({
  eventTitle = "Evento",
  eventLink = "http://localhost:3000",
}: DiscomfortReportedEmailProps) => (
  <BaseEmail
    preview={`Un jugador ha reportado una molestia para ${eventTitle}`}
    greeting="Hola,"
    body={
      <>
        Un jugador ha reportado una molestia para <strong>{eventTitle}</strong>.
      </>
    }
    ctaText="Ver evento →"
    ctaHref={eventLink}
  />
);
