"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { RugbyPosition } from "@prisma/client";

const POSITION_LABELS: Record<RugbyPosition, string> = {
  PROP_LOOSEHEAD: "1 - Pilar Zurdo",
  HOOKER: "2 - Talonador",
  PROP_TIGHTHEAD: "3 - Pilar Derecho",
  LOCK: "4/5 - Segundo línea",
  FLANKER_BLINDSIDE: "6 - Ala Ciega",
  FLANKER_OPENSIDE: "7 - Ala Abierta",
  NUMBER_EIGHT: "8 - Octavo",
  SCRUM_HALF: "9 - Medio Mêlée",
  FLY_HALF: "10 - Apertura",
  CENTER_INSIDE: "12 - Centro Interior",
  CENTER_OUTSIDE: "13 - Centro Exterior",
  WING_LEFT: "11 - Ala Izquierda",
  WING_RIGHT: "14 - Ala Derecha",
  FULLBACK: "15 - Zaguero",
  REPLACEMENT: "Reserva",
};

type Member = {
  memberId: string;
  userId: string;
  name: string;
  jerseyNumber: number | null;
  position: RugbyPosition | null;
  isCoach: boolean;
};

type Toast = { message: string; type: "success" | "error" } | null;

type Props = {
  teamId: string;
  currentUserId: string;
  isCoach: boolean;
  isOnlyCoach: boolean;
  members: Member[];
};

export function TeamRosterClient({ teamId, currentUserId, isCoach, isOnlyCoach, members }: Props) {
  const router = useRouter();
  const [kickTarget, setKickTarget] = useState<Member | null>(null);
  const [promoteTarget, setPromoteTarget] = useState<Member | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [newCoachId, setNewCoachId] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  async function handleKick() {
    if (!kickTarget) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${kickTarget.userId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al expulsar");
      setKickTarget(null);
      showToast(`${kickTarget.name} ha sido expulsado del equipo`, "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error al expulsar", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handlePromote() {
    if (!promoteTarget) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/members/${promoteTarget.userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCoach: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al promover");
      setPromoteTarget(null);
      showToast(`${promoteTarget.name} es ahora entrenador`, "success");
      router.refresh();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Error al promover", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleLeave() {
    setLoading(true);
    try {
      const body: Record<string, string> = {};
      if (isOnlyCoach && newCoachId) body.newCoachUserId = newCoachId;
      const res = await fetch(`/api/teams/${teamId}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Error al abandonar");
      router.push("/teams");
    } catch (e) {
      setLeaveOpen(false);
      setNewCoachId("");
      showToast(e instanceof Error ? e.message : "Error al abandonar", "error");
    } finally {
      setLoading(false);
    }
  }

  const transferCandidates = members.filter((m) => m.userId !== currentUserId && !m.isCoach);

  return (
    <div className="relative">
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 border text-sm font-mono font-bold uppercase tracking-widest shadow-lg whitespace-nowrap ${
            toast.type === "success"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-destructive text-destructive-foreground border-destructive"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border bg-secondary px-4 sm:px-6 py-4 flex items-center justify-between gap-3">
          <h2 className="font-mono font-bold text-sm uppercase tracking-widest text-foreground">Plantilla</h2>
          <button
            onClick={() => setLeaveOpen(true)}
            className="shrink-0 border border-destructive/40 bg-destructive/5 px-3 py-1.5 text-xs font-mono font-bold uppercase tracking-widest text-destructive hover:bg-destructive/10 transition-all"
          >
            Abandonar equipo
          </button>
        </div>

        <div className="divide-y divide-border">
          {members.map((member) => {
            const isSelf = member.userId === currentUserId;
            const showActions = isCoach && !isSelf;
            return (
              <div key={member.memberId} className="px-4 sm:px-6 py-4 hover:bg-secondary/40 transition-all">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-secondary font-heading font-black text-sm text-foreground">
                    {member.jerseyNumber ?? "—"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">
                      <span className="break-words">{member.name}</span>
                      {member.isCoach && (
                        <span className="ml-2 inline-block bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-mono font-bold uppercase tracking-widest text-primary">
                          Entrenador
                        </span>
                      )}
                    </p>
                    <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mt-0.5">
                      {member.position ? POSITION_LABELS[member.position] : "Sin posición asignada"}
                    </p>
                  </div>
                </div>
                {showActions && (
                  <div className="mt-2 flex flex-wrap gap-2 pl-[52px]">
                    {!member.isCoach && (
                      <button
                        onClick={() => setPromoteTarget(member)}
                        className="border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-widest text-primary hover:bg-primary/10 transition-all"
                      >
                        Promover a coach
                      </button>
                    )}
                    <button
                      onClick={() => setKickTarget(member)}
                      className="border border-destructive/40 bg-destructive/5 px-2.5 py-1 text-xs font-mono font-bold uppercase tracking-widest text-destructive hover:bg-destructive/10 transition-all"
                    >
                      Expulsar
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Kick modal */}
      {kickTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border p-6 w-full max-w-md">
            <h3 className="font-heading font-bold text-lg uppercase tracking-tight mb-2">
              ¿Expulsar a {kickTarget.name}?
            </h3>
            <p className="text-sm font-mono text-muted-foreground mb-6">
              El jugador será eliminado de la plantilla. Sus estadísticas y datos históricos se conservan.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                disabled={loading}
                onClick={() => setKickTarget(null)}
                className="border border-border bg-secondary px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest text-foreground hover:bg-secondary/70 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                disabled={loading}
                onClick={handleKick}
                className="border border-destructive bg-destructive px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest text-destructive-foreground hover:bg-destructive/90 transition-all disabled:opacity-50"
              >
                {loading ? "Expulsando…" : "Confirmar expulsión"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Promote modal */}
      {promoteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border p-6 w-full max-w-md">
            <h3 className="font-heading font-bold text-lg uppercase tracking-tight mb-2">
              ¿Promover a {promoteTarget.name}?
            </h3>
            <p className="text-sm font-mono text-muted-foreground mb-6">
              Pasará a tener el rol de{" "}
              <span className="font-bold text-primary">Entrenador</span> con acceso completo a la gestión del equipo.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                disabled={loading}
                onClick={() => setPromoteTarget(null)}
                className="border border-border bg-secondary px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest text-foreground hover:bg-secondary/70 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                disabled={loading}
                onClick={handlePromote}
                className="border border-primary bg-primary px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50"
              >
                {loading ? "Promoviendo…" : "Confirmar promoción"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Leave modal */}
      {leaveOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border p-6 w-full max-w-md">
            <h3 className="font-heading font-bold text-lg uppercase tracking-tight mb-2">
              ¿Abandonar el equipo?
            </h3>
            {isOnlyCoach ? (
              <>
                <p className="text-sm font-mono text-muted-foreground mb-4">
                  Eres el único coach activo. Debes transferir el rol a otro miembro antes de salir.
                </p>
                <select
                  value={newCoachId}
                  onChange={(e) => setNewCoachId(e.target.value)}
                  className="w-full border border-border bg-card px-3 py-2 text-sm font-mono text-foreground mb-6 focus:outline-none focus:border-primary"
                >
                  <option value="">— Selecciona nuevo coach —</option>
                  {transferCandidates.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </>
            ) : (
              <p className="text-sm font-mono text-muted-foreground mb-6">
                Saldrás de la plantilla. Tus estadísticas y datos históricos se conservan.
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                disabled={loading}
                onClick={() => {
                  setLeaveOpen(false);
                  setNewCoachId("");
                }}
                className="border border-border bg-secondary px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest text-foreground hover:bg-secondary/70 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                disabled={loading || (isOnlyCoach && !newCoachId)}
                onClick={handleLeave}
                className="border border-destructive bg-destructive px-4 py-2 text-xs font-mono font-bold uppercase tracking-widest text-destructive-foreground hover:bg-destructive/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Saliendo…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
