import "server-only";
import type { Metadata } from "next";
import { verifyRpeToken } from "@/lib/tokens";
import { evaluatePlayerRpe } from "@/lib/rpe-submit";
import { rpeWindow } from "@/lib/rpe-window";
import { capitalizeFirst, formatInTz, safeTz } from "@/lib/datetime";
import { RpeForm } from "@/components/training/RpeForm";

// El token va en la URL: nunca cacheada ni indexada (las cabeceras están en next.config.ts)
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Registro de RPE",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

const WHEN = "d 'de' MMMM 'a las' HH:mm 'hs'";

const EVENT_TYPE_LABEL: Record<string, string> = {
  TRAINING: "Entrenamiento",
  MATCH: "Partido",
  TOURNAMENT: "Torneo",
  TRIP: "Viaje",
  OTHER: "Evento",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FFFFFF] flex items-center justify-center p-4">
      <div className="max-w-xl w-full border border-border bg-card p-8 shadow-sm space-y-6">{children}</div>
    </div>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Shell>
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-heading font-extrabold uppercase text-foreground">{title}</h1>
        <p className="font-sans text-muted-foreground">{children}</p>
      </div>
    </Shell>
  );
}

const invalidLink = (
  <Notice title="Enlace no válido">Este enlace no es válido o ha caducado.</Notice>
);

export default async function RpeLinkPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const payload = verifyRpeToken(token);
  if (!payload) return invalidLink;

  const result = await evaluatePlayerRpe(payload.userId, payload.eventId, { requireCheckIn: true });

  if (!result.ok) {
    switch (result.code) {
      case "NOT_CHECKED_IN":
      case "NOT_ATTENDED":
        return (
          <Notice title="Registro de RPE">
            Solo pueden registrar el RPE quienes figuran como presentes en la lista del entrenador.
          </Notice>
        );
      case "WINDOW_CLOSED":
        return (
          <Notice title="Registro de RPE">
            El plazo para registrar el RPE de este evento terminó el{" "}
            {result.closesAt ? formatInTz(result.closesAt, safeTz(result.timezone), WHEN) : "—"}.
          </Notice>
        );
      case "ALREADY_RECORDED":
        return <Notice title="Registro de RPE">Ya registraste tu RPE para este evento.</Notice>;
      default:
        // Evento inexistente, ex-miembro, coach o evento sin empezar: indistinguibles
        return invalidLink;
    }
  }

  const { event } = result;
  const tz = safeTz(event.team?.timezone);
  const closesAtLabel = formatInTz(rpeWindow(event, new Date()).closesAt, tz, WHEN);

  return (
    <Shell>
      <div className="text-center space-y-2">
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          {EVENT_TYPE_LABEL[event.type] ?? event.type} · {event.team?.name}
        </p>
        <h1 className="text-3xl font-heading font-extrabold uppercase tracking-tighter text-foreground">
          {event.title}
        </h1>
        <p className="font-sans text-muted-foreground">
          {capitalizeFirst(formatInTz(event.startDate, tz, "EEEE d 'de' MMMM, HH:mm"))}
        </p>
      </div>
      <RpeForm submit={{ url: "/api/rpe/link", extraBody: { token } }} closesAtLabel={closesAtLabel} />
    </Shell>
  );
}
