"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Email o contraseña incorrectos");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/">
            <h1 className="text-5xl font-heading font-extrabold tracking-tighter uppercase text-foreground hover:opacity-80 transition-opacity">
              Rugby<span className="text-primary">Track</span>
            </h1>
          </Link>
          <p className="mt-2 text-muted-foreground font-mono uppercase tracking-widest text-xs font-semibold">
            Accede a tu cuenta
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <form id="login-form" onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive font-mono"
              >
                {error}
              </div>
            )}

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

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-heading uppercase tracking-tight font-bold text-foreground">
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                minLength={8}
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder-muted-foreground outline-none ring-ring transition-all focus:border-ring focus:ring-2 font-mono"
                placeholder="••••••••"
              />
            </div>

            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary px-4 py-4 text-sm font-mono uppercase tracking-widest font-bold text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 shadow-md hover:shadow-lg mt-2"
            >
              {loading ? "INICIANDO SESIÓN..." : "INICIAR SESIÓN"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground font-mono uppercase tracking-tight">
            ¿No tienes cuenta?{" "}
            <Link href={`/register${callbackUrl && callbackUrl !== '/dashboard' ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`} className="text-primary font-bold hover:underline">
              Regístrate
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="text-foreground font-mono uppercase tracking-widest text-xs font-semibold animate-pulse">
            Cargando...
          </div>
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
