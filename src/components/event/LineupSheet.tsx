import type { MatchFormat } from "@prisma/client";
import { SLOTS, isStarterNumber, labelFor } from "@/lib/lineup-core";

export interface SheetCallup {
  userId: string;
  name: string;
  shirtNumber: number | null;
}

/** Frase para el propio jugador convocado según su dorsal. */
export function playerStatus(format: MatchFormat, shirtNumber: number | null): string {
  if (shirtNumber == null) return "Estás convocado";
  return isStarterNumber(format, shirtNumber)
    ? `Eres titular · ${labelFor(format, shirtNumber)} (n.º ${shirtNumber})`
    : `Eres suplente (n.º ${shirtNumber})`;
}

const headingCls = "text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground border-b border-border pb-2 mb-3";

function Row({ number, label, name, mine }: { number?: number; label: string; name: string | null; mine: boolean }) {
  return (
    <div
      data-testid={mine ? "my-lineup-row" : undefined}
      aria-current={mine ? "true" : undefined}
      className={`flex items-center justify-between gap-3 border p-3 ${
        mine ? "border-primary bg-primary/10" : "border-border bg-card"
      }`}
    >
      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-muted-foreground">
        {number != null ? `${number} · ` : ""}
        {label}
      </span>
      <span className={`text-sm text-foreground ${mine ? "font-extrabold" : "font-semibold"}`}>
        {name ?? <span className="italic text-muted-foreground">—</span>}
        {mine && <span className="ml-2 text-[10px] font-mono uppercase tracking-widest text-primary">Tú</span>}
      </span>
    </div>
  );
}

/** Hoja de alineación completa: titulares por dorsal, suplentes y convocados sin dorsal. */
export function LineupSheet({ format, callups, currentUserId }: { format: MatchFormat; callups: SheetCallup[]; currentUserId: string }) {
  const { starters, total } = SLOTS[format];
  const byNumber = new Map(callups.filter((c) => c.shirtNumber != null).map((c) => [c.shirtNumber as number, c]));
  const starterNumbers = Array.from({ length: starters }, (_, i) => i + 1);
  const subNumbers = Array.from({ length: total - starters }, (_, i) => starters + i + 1).filter((n) => byNumber.has(n));
  const unnumbered = callups.filter((c) => c.shirtNumber == null || c.shirtNumber > total);

  const me = callups.find((c) => c.userId === currentUserId);

  return (
    <div className="space-y-6">
      {me && (
        <p className="border border-primary bg-primary/10 p-3 text-xs font-mono font-bold uppercase tracking-widest text-primary">
          {playerStatus(format, me.shirtNumber != null && me.shirtNumber <= total ? me.shirtNumber : null)}
        </p>
      )}

      <div>
        <h3 className={headingCls}>Titulares</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {starterNumbers.map((n) => {
            const c = byNumber.get(n);
            return <Row key={n} number={n} label={labelFor(format, n)} name={c?.name ?? null} mine={c?.userId === currentUserId} />;
          })}
        </div>
      </div>

      <div>
        <h3 className={headingCls}>Suplentes</h3>
        {subNumbers.length === 0 ? (
          <p className="text-sm text-muted-foreground italic font-mono">No hay suplentes convocados</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {subNumbers.map((n) => {
              const c = byNumber.get(n)!;
              return <Row key={n} number={n} label={labelFor(format, n)} name={c.name} mine={c.userId === currentUserId} />;
            })}
          </div>
        )}
      </div>

      <div>
        <h3 className={headingCls}>Convocados sin dorsal</h3>
        {unnumbered.length === 0 ? (
          <p className="text-sm text-muted-foreground italic font-mono">Todos los convocados tienen dorsal</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {unnumbered.map((c) => (
              <Row key={c.userId} label="Convocado" name={c.name} mine={c.userId === currentUserId} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
