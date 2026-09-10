import * as React from "react";
import { BaseEmail } from "./base";

interface ProposalCreatedEmailProps {
  userName: string;
  teamName: string;
  proposalTitle: string;
  proposalLink: string;
  authorName: string;
}

export const ProposalCreatedEmail = ({
  userName = "Miembro",
  teamName = "Tu equipo",
  proposalTitle = "Nueva propuesta",
  proposalLink = "http://localhost:3000",
  authorName = "Un compañero",
}: ProposalCreatedEmailProps) => (
  <BaseEmail
    preview={`Nueva propuesta en ${teamName}: ${proposalTitle}`}
    greeting={`Hola ${userName},`}
    body={
      <>
        <strong>{authorName}</strong> ha publicado una propuesta en{" "}
        <strong>{teamName}</strong>: <strong>{proposalTitle}</strong>
      </>
    }
    ctaText="Ver propuesta →"
    ctaHref={proposalLink}
  />
);
