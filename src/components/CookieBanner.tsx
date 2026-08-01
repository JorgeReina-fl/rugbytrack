"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "rugbytrack.cookieBanner.dismissed";

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "1") setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Aviso de cookies"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm"
    >
      <div className="mx-auto max-w-[1200px] flex flex-col md:flex-row md:items-center gap-3 md:gap-6 px-4 md:px-8 py-4">
        <p className="font-sans text-sm text-foreground/90 flex-1">
          Usamos únicamente cookies técnicas necesarias para mantener tu sesión iniciada. No usamos cookies de analítica ni publicidad.{" "}
          <Link href="/privacidad#cookies" className="underline hover:text-primary">
            Más información
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="self-end md:self-auto bg-primary text-primary-foreground font-mono uppercase text-xs tracking-tighter py-2.5 px-5 rounded-lg hover:bg-foreground hover:text-background transition-colors"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
