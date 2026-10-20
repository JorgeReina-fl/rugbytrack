/** Clases del botón del selector RPE (1–10), compartidas por el formulario del jugador y el panel del coach. */
export const getRpeColorClasses = (isSelected: boolean) => {
  if (!isSelected) {
    return "border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground hover:bg-secondary font-mono text-lg";
  }

  // Usamos el token primary con un efecto "pop" (microanimación)
  return "ring-2 ring-ring bg-primary text-primary-foreground font-bold border-transparent shadow-md scale-105 font-mono text-xl z-10";
};
