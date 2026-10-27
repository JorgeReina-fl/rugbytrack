import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyRsvpToken } from "@/lib/tokens";
import { getActiveMembership } from "@/lib/membership";
import { RsvpAction } from "./rsvp-action";
import { capitalizeFirst, formatInTz, safeTz } from "@/lib/datetime";

export default async function RsvpPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Intentamos verificar el token
  const payload = verifyRsvpToken(token);

  // Mismo aviso para token inválido y para quien ya no es miembro activo: sin datos del evento
  const invalidLink = (
    <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-heading font-extrabold uppercase text-foreground">
          Link Inválido
        </h1>
        <p className="font-sans text-muted-foreground">
          El enlace de convocatoria ha expirado o no es válido. Por favor,
          solicita uno nuevo a tu entrenador.
        </p>
      </div>
    </div>
  );

  if (!payload) return invalidLink;

  const { userId, eventId } = payload;

  const [user, event] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.event.findUnique({ where: { id: eventId }, include: { team: { select: { timezone: true } } } }),
  ]);

  if (!user || !event) {
    return notFound();
  }

  const membership = await getActiveMembership(event.teamId, userId);
  if (!membership) return invalidLink;

  const formattedDate = formatInTz(event.startDate, safeTz(event.team.timezone), "EEEE d 'de' MMMM, HH:mm");

  return (
    <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center p-4">
      <div className="max-w-xl w-full border border-border bg-card p-8 shadow-sm">
        <div className="text-center space-y-6">
          <h1 className="text-3xl font-heading font-extrabold uppercase tracking-tighter text-foreground">
            Convocatoria
          </h1>

          <div className="space-y-2">
            <p className="font-sans text-lg text-foreground">
              Hola <span className="font-bold">{user.name}</span>, has sido convocado a:
            </p>
            <p className="font-heading font-bold text-2xl uppercase text-primary">
              {event.title}
            </p>
            <p className="font-sans text-muted-foreground">
              {capitalizeFirst(formattedDate)}
            </p>
            {event.location && (
              <p className="font-sans text-sm text-muted-foreground mt-2">
                📍 {event.location}
              </p>
            )}
          </div>

          <div className="pt-6 border-t border-border">
            <RsvpAction token={token} />
          </div>
        </div>
      </div>
    </div>
  );
}
