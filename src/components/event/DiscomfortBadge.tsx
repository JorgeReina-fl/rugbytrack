/** Insignia «N molestias nuevas» para el coach en las listas de eventos. No pinta nada con 0. */
export function DiscomfortBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-block bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider">
      {count === 1 ? "1 molestia nueva" : `${count} molestias nuevas`}
    </span>
  );
}
