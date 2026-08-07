import Link from "next/link";
import { auth } from "@/auth";
import { LogoStacked } from "@/components/icons/Logo";

export default async function NotFound() {
  const session = await auth();
  const destination = session?.user ? "/dashboard" : "/";
  const ctaLabel = session?.user ? "Volver al dashboard" : "Volver al inicio";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <Link href={destination} className="inline-block hover:opacity-80 transition-opacity">
            <LogoStacked size={48} />
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
          <p className="font-mono uppercase tracking-widest text-xs font-bold text-muted-foreground">
            Error 404
          </p>
          <h1 className="mt-3 text-2xl font-heading uppercase tracking-tight font-bold text-foreground">
            Página no encontrada
          </h1>
          <p className="mt-4 text-sm text-muted-foreground font-mono">
            La ruta que buscas no existe o se ha movido. Vuelve a un lugar seguro.
          </p>

          <Link
            href={destination}
            className="mt-6 inline-block w-full rounded-xl bg-primary px-4 py-4 text-sm font-mono uppercase tracking-widest font-bold text-primary-foreground transition-all hover:opacity-90 shadow-md hover:shadow-lg"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
