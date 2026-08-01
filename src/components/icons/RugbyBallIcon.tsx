import React from "react";

export function RugbyBallIcon({ size = 24, className = "", weight = "regular" }: { size?: number | string, className?: string, weight?: string }) {
  const strokeWidth = weight === "bold" || weight === "fill" ? 24 : 16;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      className={className}
      fill="currentColor"
    >
      <rect width="256" height="256" fill="none" />
      <ellipse 
        cx="128" cy="128" 
        rx="100" ry="60" 
        transform="rotate(-45 128 128)" 
        fill="none" 
        stroke="currentColor" 
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth} 
      />
      <line 
        x1="57" y1="199" 
        x2="199" y2="57" 
        fill="none" 
        stroke="currentColor" 
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth} 
      />
      {/* Laces */}
      <line x1="112" y1="112" x2="144" y2="144" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <line x1="132" y1="92" x2="164" y2="124" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
      <line x1="92" y1="132" x2="124" y2="164" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </svg>
  );
}
