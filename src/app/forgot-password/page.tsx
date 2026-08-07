"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoStacked } from "@/components/icons/Logo";

export default function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "No se pudo procesar la solicitud.");
      } else {
        setMessage(data?.data?.message ?? "Si el email existe, recibirás un enlace.");
      }
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
            <LogoStacked size={48} />
          </Link>
          <p className="mt-4 text-muted-foreground font-mono uppercase tracking-widest text-xs font-semibold">
            Recuperar contraseña
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && (
              <div
                role="status"
                className="rounded-lg border border-border bg-muted/60 px-4 py-3 text-sm text-foreground font-mono"
              >
                {message}
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive font-mono"
              >
                {error}
              </div>
            )}

            <p className="text-sm text-muted-foreground font-mono">
              Introduce tu email y te enviaremos un enlace para restablecer la contraseña.
            </p>

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-heading uppercase tracking-tight font-bold text-foreground">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none ring-ring transition-all focus:border-ring focus:ring-2 font-mono"
                placeholder="tu@email.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary px-4 py-4 text-sm font-mono uppercase tracking-widest font-bold text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 shadow-md hover:shadow-lg mt-2"
            >
              {loading ? "ENVIANDO..." : "ENVIAR ENLACE"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground font-mono uppercase tracking-tight">
            <Link href="/login" className="text-primary font-bold hover:underline">
              Volver a iniciar sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
