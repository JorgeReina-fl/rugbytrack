"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useSocket } from "@/hooks/useSocket";
import { useRouter } from "next/navigation";

interface Props {
  teamId: string;
  initialPolls: any[];
  isCoach?: boolean;
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

export default function LivePollClient({ teamId, initialPolls, isCoach = false }: Props) {
  const { socket } = useSocket(undefined, teamId);
  const [polls, setPolls] = useState(initialPolls);
  const router = useRouter();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket) return;

    socket.emit("join_team", { teamId });

    socket.on("poll_update", (data: any) => {
      setPolls((prev: any) =>
        prev.map((p: any) => {
          if (p.id === data.pollId) {
            return {
              ...p,
              options: p.options.map((opt: any) => {
                const updatedOpt = data.options.find((o: any) => o.id === opt.id);
                if (updatedOpt) {
                  return { ...opt, _count: { votes: updatedOpt.votesCount } };
                }
                return opt;
              }),
            };
          }
          return p;
        })
      );
    });

    return () => {
      socket.off("poll_update");
    };
  }, [socket, teamId]);

  const handleVote = async (pollId: string, optionId: string) => {
    try {
      const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const error = await res.json();
        alert(error.error || "Error al votar");
      }
    } catch (e) {
      console.error(e);
      alert("Error al votar");
    }
  };

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setOptions(["", ""]);
    setFormError(null);
    setSubmitting(false);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const updateOption = (idx: number, value: string) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  };

  const addOption = () => {
    if (options.length < MAX_OPTIONS) setOptions((prev) => [...prev, ""]);
  };

  const removeOption = (idx: number) => {
    if (options.length > MIN_OPTIONS) setOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const createPoll = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
    if (!title.trim()) {
      setFormError("El título es obligatorio");
      return;
    }
    if (cleanOptions.length < MIN_OPTIONS) {
      setFormError(`Necesitas al menos ${MIN_OPTIONS} opciones no vacías`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/polls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          options: cleanOptions,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setPolls([created.data, ...polls]);
        closeModal();
        router.refresh();
      } else {
        const err = await res.json().catch(() => ({}));
        setFormError(err?.error || "Error al crear la encuesta");
        setSubmitting(false);
      }
    } catch (err) {
      console.error(err);
      setFormError("Error al crear la encuesta");
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {isCoach && (
        <div className="flex justify-end">
          <button
            onClick={() => setIsModalOpen(true)}
            id="create-poll-btn"
            className="bg-primary text-primary-foreground px-4 py-2 rounded font-bold uppercase text-xs tracking-widest hover:opacity-90 transition-all"
          >
            + Nueva Encuesta
          </button>
        </div>
      )}

      {polls.length === 0 && (
        <div className="text-center text-gray-500 py-10 bg-white rounded-xl shadow-sm border border-gray-100">
          No hay encuestas activas.
        </div>
      )}
      {polls.map((poll: any) => {
        const totalVotes = poll.options.reduce((acc: number, opt: any) => acc + opt._count.votes, 0);

        return (
          <div key={poll.id} className="p-6 bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-4">
              {poll.createdBy.image && (
                <Image src={poll.createdBy.image} alt={poll.createdBy.name} width={32} height={32} className="rounded-full" />
              )}
              <div>
                <h3 className="text-xl font-bold text-gray-900">{poll.title}</h3>
                <p className="text-sm text-gray-500">Por {poll.createdBy.name}</p>
              </div>
            </div>
            {poll.description && <p className="text-gray-600 mt-2 mb-4">{poll.description}</p>}
            <div className="space-y-3">
              {poll.options.map((opt: any) => {
                const percentage = totalVotes === 0 ? 0 : Math.round((opt._count.votes / totalVotes) * 100);
                return (
                  <div key={opt.id} className="relative group cursor-pointer" onClick={() => handleVote(poll.id, opt.id)}>
                    <div className="absolute top-0 left-0 h-full bg-blue-100 rounded-lg transition-all duration-500 ease-out" style={{ width: `${percentage}%` }}></div>
                    <div className="relative p-3 flex justify-between items-center z-10 border border-gray-200 rounded-lg hover:border-blue-300">
                      <span className="font-medium text-gray-800">{opt.text}</span>
                      <span className="text-sm font-semibold text-blue-600">{opt._count.votes} ({percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border p-6 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold mb-4">Nueva Encuesta</h3>
            <form onSubmit={createPoll}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-1">Título</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full border p-2 rounded bg-background"
                    placeholder="p.ej. ¿Cambiamos la hora del entreno?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-1">
                    Descripción <span className="text-muted-foreground font-normal">(opcional)</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full border p-2 rounded bg-background h-20"
                  ></textarea>
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2">
                    Opciones <span className="text-muted-foreground font-normal">({MIN_OPTIONS}–{MAX_OPTIONS})</span>
                  </label>
                  <div className="space-y-2">
                    {options.map((opt, idx) => (
                      <div key={idx} className="flex gap-2">
                        <input
                          type="text"
                          value={opt}
                          onChange={(e) => updateOption(idx, e.target.value)}
                          placeholder={`Opción ${idx + 1}`}
                          className="flex-1 border p-2 rounded bg-background"
                          required={idx < MIN_OPTIONS}
                        />
                        {options.length > MIN_OPTIONS && (
                          <button
                            type="button"
                            onClick={() => removeOption(idx)}
                            className="px-3 border border-border rounded text-muted-foreground hover:text-destructive hover:border-destructive transition-all"
                            aria-label={`Eliminar opción ${idx + 1}`}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {options.length < MAX_OPTIONS && (
                    <button
                      type="button"
                      onClick={addOption}
                      className="mt-2 text-xs font-mono font-bold uppercase tracking-widest text-primary hover:opacity-80"
                    >
                      + Añadir opción
                    </button>
                  )}
                </div>
                {formError && (
                  <p className="text-sm text-destructive font-mono">{formError}</p>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={submitting}
                  className="px-4 py-2 text-sm font-bold text-muted-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-primary text-primary-foreground px-4 py-2 rounded text-sm font-bold disabled:opacity-50"
                >
                  {submitting ? "Creando…" : "Crear encuesta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
