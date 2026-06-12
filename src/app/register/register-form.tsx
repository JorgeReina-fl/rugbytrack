"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const name = form.get("name") as string;
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    const confirm = form.get("confirmPassword") as string;

    if (password !== confirm) {
      setError("Las contraseñas no coinciden");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error ?? "Error al crear la cuenta");
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Cuenta creada. Por favor inicia sesión.");
        router.push(`/login${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`);
        return;
      }

      router.push(callbackUrl ?? "/dashboard");
      router.refresh();
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
      setLoading(false);
    }
  }

  return (
    <form id="register-form" onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div role="alert" className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive font-mono">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="register-name" className="mb-1.5 block text-sm font-heading uppercase tracking-tight font-bold text-foreground">
          Nombre completo
        </label>
        <input
          id="register-name"
          name="name"
          type="text"
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none ring-ring transition-all focus:border-ring focus:ring-2 font-mono"
          placeholder="Carlos García"
        />
      </div>

      <div>
        <label htmlFor="register-email" className="mb-1.5 block text-sm font-heading uppercase tracking-tight font-bold text-foreground">
          Email
        </label>
        <input
          id="register-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none ring-ring transition-all focus:border-ring focus:ring-2 font-mono"
          placeholder="tu@email.com"
        />
      </div>

      <div>
        <label htmlFor="register-password" className="mb-1.5 block text-sm font-heading uppercase tracking-tight font-bold text-foreground">
          Contraseña <span className="text-muted-foreground font-mono text-xs">(mín. 8 caracteres)</span>
        </label>
        <input
          id="register-password"
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none ring-ring transition-all focus:border-ring focus:ring-2 font-mono"
          placeholder="••••••••"
        />
      </div>

      <div>
        <label htmlFor="register-confirm" className="mb-1.5 block text-sm font-heading uppercase tracking-tight font-bold text-foreground">
          Confirmar contraseña
        </label>
        <input
          id="register-confirm"
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none ring-ring transition-all focus:border-ring focus:ring-2 font-mono"
          placeholder="••••••••"
        />
      </div>

      <button
        id="register-submit"
        type="submit"
        disabled={loading}
        className="w-full rounded-xl bg-primary px-4 py-4 text-sm font-mono uppercase tracking-widest font-bold text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 shadow-md hover:shadow-lg mt-2"
      >
        {loading ? "CREANDO CUENTA..." : "CREAR CUENTA"}
      </button>
    </form>
  );
}
