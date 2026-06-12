"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateThreadForm({ teamId }: { teamId: string }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const title = form.get("title") as string;
    const content = form.get("content") as string;

    try {
      const res = await fetch(`/api/teams/${teamId}/forum`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al crear el hilo");
      }

      setIsOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full sm:w-auto rounded-xl bg-primary px-6 py-3 text-sm font-mono uppercase tracking-widest font-bold text-primary-foreground hover:opacity-90 transition-all shadow-md"
      >
        + NUEVO DEBATE
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm mb-8 animate-in fade-in slide-in-from-top-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-heading font-bold uppercase tracking-tight text-foreground">Crear Nuevo Debate</h3>
        <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground font-mono">
          ✕ Cancelar
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive font-mono">
            {error}
          </div>
        )}
        
        <div>
          <label htmlFor="title" className="mb-1.5 block text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">
            Título del Debate
          </label>
          <input
            id="title"
            name="title"
            type="text"
            required
            minLength={5}
            maxLength={100}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none ring-ring transition-all focus:border-ring focus:ring-2 font-mono"
            placeholder="Ej: Análisis Táctico vs. Rival X"
          />
        </div>

        <div>
          <label htmlFor="content" className="mb-1.5 block text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">
            Contenido
          </label>
          <textarea
            id="content"
            name="content"
            required
            minLength={10}
            rows={4}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none ring-ring transition-all focus:border-ring focus:ring-2 font-sans resize-none"
            placeholder="Escribe aquí tu análisis o comentario..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary px-4 py-4 text-sm font-mono uppercase tracking-widest font-bold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "PUBLICANDO..." : "PUBLICAR DEBATE"}
        </button>
      </form>
    </div>
  );
}
