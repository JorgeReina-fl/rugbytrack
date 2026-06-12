"use client";

import { useRouter } from "next/navigation";

interface Props {
  teams: { id: string; name: string }[];
  selectedTeamId: string;
}

export default function TeamSelector({ teams, selectedTeamId }: Props) {
  const router = useRouter();

  return (
    <div className="relative">
      <select
        defaultValue={selectedTeamId}
        onChange={(e) => {
          router.push(`/events?teamId=${e.target.value}`);
        }}
        className="appearance-none border border-border bg-card px-4 py-2.5 pr-10 text-sm font-mono font-bold text-foreground uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
      >
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
        ▼
      </div>
    </div>
  );
}
