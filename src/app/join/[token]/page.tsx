import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import JoinTeamForm from "./join-form";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Unirse al equipo | RugbyTrack",
};

export default async function JoinTeamPage({ params }: PageProps) {
  const { token } = await params;

  if (!/^[a-zA-Z0-9]{12}$/.test(token)) notFound();

  const team = await prisma.team.findUnique({
    where: { inviteToken: token },
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { members: true } },
    },
  });

  if (!team) notFound();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header branding */}
        <div className="mb-10 text-center">
          <p className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground mb-3">
            Invitación al equipo
          </p>
          <div className="mb-4 text-5xl">🏉</div>
          <h1 className="text-4xl font-heading font-extrabold uppercase tracking-tighter text-foreground">
            Únete a{" "}
            <span className="text-primary">{team.name}</span>
          </h1>
          {team.description && (
            <p className="mt-3 text-sm text-muted-foreground font-mono">{team.description}</p>
          )}
          <p className="mt-2 text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground">
            {team._count.members} miembros ya en el equipo
          </p>
        </div>

        {/* Formulario en tarjeta blanca con borde duro */}
        <div className="border border-border bg-card shadow-lg p-8">
          <JoinTeamForm token={token} teamId={team.id} />
        </div>

        {/* Footer informativo */}
        <p className="mt-6 text-center text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          RugbyTrack · Gestión deportiva profesional
        </p>
      </div>
    </div>
  );
}
