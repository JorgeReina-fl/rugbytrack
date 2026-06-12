import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { verifyRsvpToken } from "@/lib/tokens";
import { RsvpAction } from "./rsvp-action";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export default async function RsvpPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Intentamos verificar el token
  const payload = verifyRsvpToken(token);

  if (!payload) {
    return (
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
  }

  const { userId, eventId } = payload;

  const [user, event] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.event.findUnique({ where: { id: eventId } }),
  ]);

  if (!user || !event) {
    return notFound();
  }

  const formattedDate = format(new Date(event.startDate), "EEEE d 'de' MMMM, HH:mm", {
    locale: es,
  });

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
            <p className="font-sans text-muted-foreground capitalize">
              {formattedDate}
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
