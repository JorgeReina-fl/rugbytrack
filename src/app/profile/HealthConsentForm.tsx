"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function HealthConsentForm({ consentDate }: { consentDate: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function withdraw() {
    if (!confirm("Se borrarán todas tus molestias registradas. ¿Continuar?")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/health-consent", { method: "DELETE" });
      if (!res.ok) throw new Error();
      const { deleted } = await res.json();
      setMessage(`Consentimiento retirado. Se han borrado ${deleted} molestias.`);
      router.refresh();
    } catch {
      setError("No se pudo retirar el consentimiento");
    } finally {
      setBusy(false);
    }
  }

  if (message) return <p role="status" className="text-sm font-mono text-foreground">{message}</p>;

  return (
    <div className="space-y-4">
      <p className="text-sm font-mono text-foreground">Has dado consentimiento para datos de salud el {consentDate}</p>
      {error && <p role="alert" className="text-xs text-destructive font-mono">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={withdraw}
        className="rounded-none border border-destructive px-4 py-3 text-xs font-mono uppercase tracking-widest font-bold text-destructive hover:bg-destructive/10 transition-all disabled:opacity-50"
      >
        Retirar consentimiento
      </button>
    </div>
  );
}
