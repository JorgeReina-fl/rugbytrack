"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogoutButton } from "@/components/auth/LogoutButton";

export default function NewTeamPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const payload = {
      name: form.get("name") as string,
      description: form.get("description") as string || undefined,
    };

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Error al crear el equipo");
        setLoading(false);
        return;
      }

      router.push(`/teams/${json.data.id}`);
      router.refresh();
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground pb-10">
      <nav className="border-b border-border bg-background/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <Link href="/dashboard" className="text-xl font-heading font-extrabold tracking-tighter uppercase">
            Rugby<span className="text-primary">Track</span>
          </Link>
          <div className="flex items-center gap-4">
            <LogoutButton />
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-xl px-4 py-12">
        <div className="mb-8">
          <Link href="/teams" className="text-xs font-mono font-bold uppercase tracking-widest text-muted-foreground hover:text-primary transition-all flex items-center gap-2">
            ← Volver a Mis Equipos
          </Link>
          <h1 className="mt-8 text-5xl font-heading font-extrabold tracking-tighter uppercase text-foreground">Crear equipo</h1>
          <p className="mt-2 font-mono uppercase text-xs tracking-widest font-semibold text-muted-foreground">
            Tu equipo recibirá un link de invitación único
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-10 shadow-sm">
          <form id="create-team-form" onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div role="alert" className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive font-mono">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="team-name" className="mb-1.5 block text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">
                Nombre del equipo *
              </label>
              <input
                id="team-name"
                name="name"
                type="text"
                required
                minLength={2}
                maxLength={80}
                autoComplete="off"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none ring-ring transition-all focus:border-primary focus:ring-2 font-mono"
                placeholder="Ej: RC Sevilla"
              />
            </div>

            <div>
              <label htmlFor="team-description" className="mb-1.5 block text-xs font-mono uppercase tracking-widest font-bold text-muted-foreground">
                Descripción <span className="opacity-70">(opcional)</span>
              </label>
              <textarea
                id="team-description"
                name="description"
                rows={3}
                maxLength={500}
                className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none ring-ring transition-all focus:border-primary focus:ring-2 font-sans"
                placeholder="Club de rugby amateur de Sevilla, categoría senior..."
              />
            </div>

            <button
              id="create-team-submit"
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary px-4 py-4 text-sm font-mono uppercase tracking-widest font-bold text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 shadow-md"
            >
              {loading ? "CREANDO EQUIPO..." : "CREAR EQUIPO"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
