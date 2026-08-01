"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { List, X } from "@phosphor-icons/react";

export function MobileNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="md:hidden inline-flex items-center justify-center h-10 w-10 rounded-lg border border-border hover:border-primary hover:text-primary transition-colors"
      >
        {open ? <X size={20} weight="bold" /> : <List size={20} weight="bold" />}
      </button>

      {open && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-end px-6 py-6 border-b border-border">
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center h-10 w-10 rounded-lg border border-border hover:border-primary hover:text-primary transition-colors"
            >
              <X size={20} weight="bold" />
            </button>
          </div>
          <nav className="flex flex-col gap-2 p-6 font-mono text-lg uppercase tracking-tighter">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="py-3 border-b border-border hover:text-primary transition-colors"
            >
              Inicio
            </Link>
            <Link
              href="#features"
              onClick={() => setOpen(false)}
              className="py-3 border-b border-border hover:text-primary transition-colors"
            >
              Características
            </Link>
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="py-3 border-b border-border hover:text-primary transition-colors"
            >
              Iniciar Sesión
            </Link>
          </nav>
        </div>
      )}
    </>
  );
}
