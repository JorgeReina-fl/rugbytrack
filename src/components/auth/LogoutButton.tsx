"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button 
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="text-xs font-mono uppercase tracking-tight text-foreground hover:text-primary transition-colors font-bold"
    >
      Cerrar Sesión
    </button>
  );
}
