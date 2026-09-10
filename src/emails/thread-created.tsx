import * as React from "react";
import { BaseEmail } from "./base";

interface ThreadCreatedEmailProps {
  userName: string;
  teamName: string;
  threadTitle: string;
  authorName: string;
  threadLink: string;
}

export const ThreadCreatedEmail = ({
  userName = "Miembro",
  teamName = "Tu equipo",
  threadTitle = "Nuevo hilo",
  authorName = "Un miembro",
  threadLink = "http://localhost:3000",
}: ThreadCreatedEmailProps) => (
  <BaseEmail
    preview={`Nuevo hilo en ${teamName}: ${threadTitle}`}
    greeting={`Hola ${userName},`}
    body={
      <>
        <strong>{authorName}</strong> ha publicado un nuevo hilo en el foro de{" "}
        <strong>{teamName}</strong>: <strong>{threadTitle}</strong>
      </>
    }
    ctaText="Ver hilo →"
    ctaHref={threadLink}
  />
);
