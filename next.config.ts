import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  serverExternalPackages: ["argon2", "pino", "mongoose"],

  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        {
          key: "Permissions-Policy",
          value: "camera=(), microphone=(), geolocation=()",
        },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: https://avatars.githubusercontent.com",
            "connect-src 'self'",
            "worker-src 'self'",
            "object-src 'none'",
            "frame-ancestors 'none'",
          ].join("; "),
        },
      ],
    },
    {
      // El token del enlace de RPE va en la URL: ni referrer, ni caché, ni indexación.
      // Va después de la regla global para que su Referrer-Policy prevalezca.
      source: "/rpe/:path*",
      headers: [
        { key: "Referrer-Policy", value: "no-referrer" },
        { key: "Cache-Control", value: "no-store" },
        { key: "X-Robots-Tag", value: "noindex, nofollow" },
      ],
    },
  ],
};

export default nextConfig;
