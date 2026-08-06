"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LogoStacked } from "@/components/icons/Logo";

const DEMO_EMAIL = "demo@rugbytrack.es";
const DEMO_PASSWORD = "rugby2026demo";

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [copied, setCopied] = useState<"email" | "password" | null>(null);

  async function submitCredentials(email: string, password: string) {
    setError(null);
    setLoading(true);

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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;
    await submitCredentials(email, password);
  }

  async function copyToClipboard(value: string, kind: "email" | "password") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied((c) => (c === kind ? null : c)), 1500);
    } catch {
      setCopied(null);
    }
  }

  async function handleDemoLogin() {
    const emailInput = document.getElementById("email") as HTMLInputElement | null;
    const passwordInput = document.getElementById("password") as HTMLInputElement | null;
    if (emailInput) emailInput.value = DEMO_EMAIL;
    if (passwordInput) passwordInput.value = DEMO_PASSWORD;
    await submitCredentials(DEMO_EMAIL, DEMO_PASSWORD);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-block hover:opacity-80 transition-opacity">
            <LogoStacked size={48} />
          </Link>
          <p className="mt-4 text-muted-foreground font-mono uppercase tracking-widest text-xs font-semibold">
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

          <div className="mt-6 rounded-xl border border-border bg-muted/40">
            <button
              type="button"
              onClick={() => setDemoOpen((v) => !v)}
              aria-expanded={demoOpen}
              aria-controls="demo-account-panel"
              className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-xs font-mono uppercase tracking-widest font-bold text-foreground transition-colors hover:bg-muted"
            >
              <span>Cuenta de demostración</span>
              <span
                aria-hidden="true"
                className={`transition-transform duration-200 ${demoOpen ? "rotate-180" : ""}`}
              >
                ▾
              </span>
            </button>

            {demoOpen && (
              <div id="demo-account-panel" className="space-y-3 border-t border-border px-4 py-4">
                <p className="text-xs text-muted-foreground font-mono">
                  Usa estas credenciales para explorar la plataforma sin registrarte.
                </p>

                <div>
                  <label className="mb-1.5 block text-xs font-heading uppercase tracking-tight font-bold text-foreground">
                    Email demo
                  </label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={DEMO_EMAIL}
                      className="flex-1 min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground font-mono outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(DEMO_EMAIL, "email")}
                      className="rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono uppercase tracking-widest font-bold text-foreground transition-colors hover:bg-muted whitespace-nowrap"
                    >
                      {copied === "email" ? "✓" : "Copiar"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-heading uppercase tracking-tight font-bold text-foreground">
                    Contraseña demo
                  </label>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={DEMO_PASSWORD}
                      className="flex-1 min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground font-mono outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => copyToClipboard(DEMO_PASSWORD, "password")}
                      className="rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono uppercase tracking-widest font-bold text-foreground transition-colors hover:bg-muted whitespace-nowrap"
                    >
                      {copied === "password" ? "✓" : "Copiar"}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDemoLogin}
                  disabled={loading}
                  className="w-full rounded-xl bg-secondary px-4 py-3 text-xs font-mono uppercase tracking-widest font-bold text-secondary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? "ENTRANDO..." : "Entrar con cuenta demo"}
                </button>
              </div>
            )}
          </div>
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
