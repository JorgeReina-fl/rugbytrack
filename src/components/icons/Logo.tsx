import React from "react";

type Variant = "color" | "mono-dark" | "mono-light";

interface LogoProps {
  size?: number;
  variant?: Variant;
  className?: string;
}

function getColors(variant: Variant) {
  if (variant === "mono-dark")  return { post: "#000000", bar: "#000000" };
  if (variant === "mono-light") return { post: "#FFFFFF", bar: "#FFFFFF" };
  return { post: "#7F77DD", bar: "#3C3489" };
}

/**
 * Logomark aislado — postes en H + 3 barras ascendentes.
 * viewBox 40×40. Dos uprights (#7F77DD), travesaño + 3 barras (#3C3489).
 */
export function LogoMark({ size = 40, variant = "color", className }: LogoProps) {
  const { post, bar } = getColors(variant);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      {/* Uprights / postes verticales */}
      <rect x="0"  y="0" width="4" height="40" fill={post} />
      <rect x="36" y="0" width="4" height="40" fill={post} />
      {/* Travesaño */}
      <rect x="0" y="26" width="40" height="4" fill={bar} />
      {/* Barras ascendentes — ancladas al travesaño, crecen izq→der */}
      <rect x="8"  y="20" width="6" height="6"  fill={bar} />
      <rect x="17" y="14" width="6" height="12" fill={bar} />
      <rect x="26" y="8"  width="6" height="18" fill={bar} />
    </svg>
  );
}

/**
 * Logo horizontal — logomark + wordmark "RugbyTrack".
 * Para headers y nav.
 */
export function LogoHorizontal({ size = 40, variant = "color", className }: LogoProps) {
  const textColor =
    variant === "mono-light" ? "text-white"
    : variant === "mono-dark"  ? "text-black"
    : "text-foreground";
  const accent = variant === "color" ? "text-primary" : "";
  const fs = Math.round(size * 0.52);

  return (
    <span className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <LogoMark size={size} variant={variant} />
      <span
        className={`font-heading font-extrabold tracking-tighter uppercase leading-none ${textColor}`}
        style={{ fontSize: fs }}
      >
        Rugby<span className={accent}>Track</span>
      </span>
    </span>
  );
}

/**
 * Logo apilado — logomark encima, wordmark debajo.
 * Para login/register y breakpoints reducidos.
 */
export function LogoStacked({ size = 48, variant = "color", className }: LogoProps) {
  const textColor =
    variant === "mono-light" ? "text-white"
    : variant === "mono-dark"  ? "text-black"
    : "text-foreground";
  const accent = variant === "color" ? "text-primary" : "";
  const fs = Math.round(size * 0.6);

  return (
    <span className={`inline-flex flex-col items-center gap-2 ${className ?? ""}`}>
      <LogoMark size={size} variant={variant} />
      <span
        className={`font-heading font-extrabold tracking-tighter uppercase leading-none ${textColor}`}
        style={{ fontSize: fs }}
      >
        Rugby<span className={accent}>Track</span>
      </span>
    </span>
  );
}
