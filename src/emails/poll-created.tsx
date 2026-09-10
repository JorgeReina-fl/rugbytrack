import * as React from "react";
import { BaseEmail } from "./base";

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
  <BaseEmail
    preview={`Nueva encuesta en ${teamName}: ${pollTitle}`}
    greeting={`Hola ${userName},`}
    body={
      <>
        Se ha publicado una nueva encuesta en <strong>{teamName}</strong>:{" "}
        <strong>{pollTitle}</strong>
      </>
    }
    ctaText="Ver encuesta y votar →"
    ctaHref={pollLink}
  />
);
