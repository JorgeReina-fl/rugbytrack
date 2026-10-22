import "server-only";
import { auth } from "@/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActiveMembership } from "@/lib/membership";
import { defaultFormatForTeam } from "@/lib/lineup";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { LineupForm } from "./lineup-form";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditLineupPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    select: {
      id: true,
      teamId: true,
      title: true,
      type: true,
      format: true,
      startDate: true,
      callups: { select: { userId: true, shirtNumber: true, user: { select: { name: true } } } },
    },
  });
  if (!event) notFound();

  const membership = await getActiveMembership(event.teamId, session.user.id);
  const editable =
    membership?.isCoach === true &&
    (event.type === "MATCH" || event.type === "TOURNAMENT") &&
    new Date(event.startDate) > new Date();
  if (!editable) notFound();

  const players = await prisma.teamMember.findMany({
    where: { teamId: event.teamId, leftAt: null, isCoach: false },
    select: { userId: true, user: { select: { name: true } } },
    orderBy: { user: { name: "asc" } },
  });
  const members = players.map((m) => ({ userId: m.userId, name: m.user.name }));
  for (const c of event.callups) {
    if (!members.some((m) => m.userId === c.userId)) members.push({ userId: c.userId, name: c.user.name });
  }

  const format = event.format ?? (await defaultFormatForTeam(event.teamId));

  return (
    <div className="min-h-screen bg-background text-foreground pb-10">
      <DashboardHeader badgeLabel="Entrenador" />

      <main className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-6">
          <Link
            href={`/events/${event.id}`}
            className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all"
          >
            ← Volver al evento
          </Link>
        </div>
        <h1 className="text-4xl font-heading font-extrabold tracking-tighter uppercase">Editar alineación</h1>
        <p className="mt-2 mb-8 text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">{event.title}</p>

        <LineupForm
          eventId={event.id}
          members={members}
          initialFormat={format}
          initialPlayers={event.callups.map((c) => ({ userId: c.userId, shirtNumber: c.shirtNumber }))}
        />
      </main>
    </div>
  );
}
