"use client";

import { useState } from "react";

export default function ChangePasswordForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const currentPassword = form.get("currentPassword") as string;
    const newPassword = form.get("newPassword") as string;
    const confirmPassword = form.get("confirmPassword") as string;

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas nuevas no coinciden");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/profile/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Error al cambiar la contraseña");
      } else {
        setSuccess(true);
        (e.target as HTMLFormElement).reset();
      }
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div role="alert" className="border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive font-mono">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="border border-primary bg-secondary px-4 py-3 text-sm font-mono text-foreground">
          Contraseña actualizada correctamente.
        </div>
      )}

      <div>
        <label htmlFor="cp-current" className="mb-1.5 block text-sm font-heading uppercase tracking-tight font-bold text-foreground">
          Contraseña actual
        </label>
        <input
          id="cp-current"
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="w-full border border-input bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-ring focus:ring-2 ring-ring font-mono"
          placeholder="••••••••"
        />
      </div>

      <div>
        <label htmlFor="cp-new" className="mb-1.5 block text-sm font-heading uppercase tracking-tight font-bold text-foreground">
          Nueva contraseña{" "}
          <span className="text-muted-foreground font-mono text-xs font-normal normal-case tracking-normal">
            (mín. 8 caracteres)
          </span>
        </label>
        <input
          id="cp-new"
          name="newPassword"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          className="w-full border border-input bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-ring focus:ring-2 ring-ring font-mono"
          placeholder="••••••••"
        />
      </div>

      <div>
        <label htmlFor="cp-confirm" className="mb-1.5 block text-sm font-heading uppercase tracking-tight font-bold text-foreground">
          Confirmar nueva contraseña
        </label>
        <input
          id="cp-confirm"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          className="w-full border border-input bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none focus:border-ring focus:ring-2 ring-ring font-mono"
          placeholder="••••••••"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-primary px-4 py-3 text-sm font-mono uppercase tracking-widest font-bold text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "GUARDANDO..." : "CAMBIAR CONTRASEÑA"}
      </button>
    </form>
  );
}
