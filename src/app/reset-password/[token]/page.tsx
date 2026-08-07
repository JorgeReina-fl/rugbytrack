"use client";

import { useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoStacked } from "@/components/icons/Logo";

export default function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const form = new FormData(e.currentTarget);
    const password = form.get("password") as string;
    const confirm = form.get("confirm") as string;

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data?.error ?? "No se pudo restablecer la contraseña.");
      } else {
        setSuccess(data?.data?.message ?? "Contraseña actualizada.");
        setTimeout(() => router.push("/login"), 1800);
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
            Nueva contraseña
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            {success && (
              <div role="status" className="rounded-lg border border-border bg-muted/60 px-4 py-3 text-sm text-foreground font-mono">
                {success}
              </div>
            )}
            {error && (
              <div role="alert" className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive font-mono">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-heading uppercase tracking-tight font-bold text-foreground">
                Nueva contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none ring-ring transition-all focus:border-ring focus:ring-2 font-mono"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label htmlFor="confirm" className="mb-1.5 block text-sm font-heading uppercase tracking-tight font-bold text-foreground">
                Confirmar contraseña
              </label>
              <input
                id="confirm"
                name="confirm"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none ring-ring transition-all focus:border-ring focus:ring-2 font-mono"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !!success}
              className="w-full rounded-xl bg-primary px-4 py-4 text-sm font-mono uppercase tracking-widest font-bold text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 shadow-md hover:shadow-lg mt-2"
            >
              {loading ? "GUARDANDO..." : "RESTABLECER CONTRASEÑA"}
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
