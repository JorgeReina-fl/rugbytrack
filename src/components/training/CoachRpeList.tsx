import Link from "next/link";
import { PlayerRpeControl, type PlayerRpeEntry } from "@/components/event/PlayerRpeControl";

export interface CoachRpeRow {
  userId: string;
  name: string;
  checkedIn: boolean;
  /** Nota del jugador (solo lectura). */
  notes: string | null;
  entry: PlayerRpeEntry | null;
}

interface CoachRpeListProps {
  eventId: string;
  started: boolean;
  /** Presentes y no presentes con RPE previo, ya filtrados por la página. */
  rows: CoachRpeRow[];
}

export function CoachRpeList({ eventId, started, rows }: CoachRpeListProps) {
  const presentes = rows.filter((r) => r.checkedIn);
  const conRpe = presentes.filter((r) => r.entry).length;

  return (
    <div className="mt-6 border-t border-border pt-4">
      <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground mb-3">
        Respuestas de Jugadores ({conRpe} de {presentes.length} presentes)
      </h4>
      {presentes.length === 0 && (
        <p className="text-xs text-muted-foreground italic font-mono mb-3">
          <Link href={`/events/${eventId}/attendance`} className="underline hover:text-primary">
            Pasa lista en el Panel de Asistencia para anotar el RPE
          </Link>
        </p>
      )}
      {rows.length > 0 && (
        <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
          {rows.map((row) => (
            <div
              key={row.userId}
              className="flex flex-col border border-border p-3 bg-background rounded-none text-xs font-mono"
            >
              <span className="font-bold text-foreground uppercase mb-2">{row.name}</span>
              <PlayerRpeControl
                eventId={eventId}
                userId={row.userId}
                name={row.name}
                checkedIn={row.checkedIn}
                started={started}
                entry={row.entry}
              />
              {row.notes && (
                <p className="text-[10px] text-muted-foreground mt-1 bg-secondary/30 p-2 italic border-l border-primary/30">
                  "{row.notes}"
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
