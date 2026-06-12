"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateCommentForm({ threadId }: { threadId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = e.currentTarget;
    const content = (form.elements.namedItem("content") as HTMLTextAreaElement).value;

    try {
      const res = await fetch(`/api/forum/${threadId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al publicar comentario");
      }

      form.reset();
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm mt-8">
      <h3 className="text-sm font-heading font-bold uppercase tracking-tight text-foreground mb-4">Añadir Comentario</h3>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive font-mono">
            {error}
          </div>
        )}

        <div>
          <textarea
            name="content"
            required
            minLength={2}
            rows={3}
            className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none ring-ring transition-all focus:border-ring focus:ring-2 font-sans resize-none"
            placeholder="Escribe tu respuesta..."
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-primary px-6 py-3 text-sm font-mono uppercase tracking-widest font-bold text-primary-foreground transition-all hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "ENVIANDO..." : "RESPONDER"}
          </button>
        </div>
      </form>
    </div>
  );
}
