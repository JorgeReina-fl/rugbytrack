"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { LogoHorizontal } from "@/components/icons/Logo";

interface DashboardHeaderProps {
  badgeLabel?: string | null;
}

export function DashboardHeader({ badgeLabel }: DashboardHeaderProps = {}) {
  const { data: session } = useSession();
  const user = session?.user;

  const label =
    badgeLabel === null
      ? null
      : badgeLabel ??
        (user?.role === "COACH" ? "Entrenador" : user ? "Jugador" : null);

  return (
    <nav className="border-b border-border bg-background/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link href="/dashboard" aria-label="Dashboard">
          <LogoHorizontal size={32} />
        </Link>
        <div className="flex items-center gap-4">
          {user?.name && (
            <span className="text-sm font-mono uppercase tracking-widest font-semibold text-muted-foreground hidden md:inline">
              {user.name}
            </span>
          )}
          {label && (
            <>
              <span className="rounded-full bg-secondary px-3 py-1 text-xs font-mono font-bold uppercase tracking-widest text-foreground hidden md:inline-block">
                {label}
              </span>
              <div className="w-px h-4 bg-border hidden md:block" />
            </>
          )}
          <LogoutButton />
        </div>
      </div>
    </nav>
  );
}
