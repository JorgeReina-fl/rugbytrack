import { Suspense } from "react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import RegisterForm from "./register-form";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Crear cuenta",
};

interface PageProps {
  searchParams: Promise<{ callbackUrl?: string }>;
}

export default async function RegisterPage({ searchParams }: PageProps) {
  const { callbackUrl } = await searchParams;
  const session = await auth();
  if (session?.user) redirect(callbackUrl ?? "/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-heading font-extrabold tracking-tighter uppercase text-foreground">
            Rugby<span className="text-primary">Track</span>
          </h1>
          <p className="mt-2 text-muted-foreground font-mono uppercase tracking-widest text-xs font-semibold">
            Crea tu cuenta
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <Suspense fallback={<div className="text-foreground font-mono text-center py-4">Cargando...</div>}>
            <RegisterForm />
          </Suspense>

          <p className="mt-6 text-center text-sm text-muted-foreground font-mono uppercase tracking-tight">
            ¿Ya tienes cuenta?{" "}
            <Link href={`/login${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`} className="text-primary font-bold hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
