import type { Metadata } from "next";
import { Anek_Tamil, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";

const anekTamil = Anek_Tamil({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-anek-tamil",
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "RugbyTrack",
    template: "%s | RugbyTrack",
  },
  description:
    "Plataforma de gestión y rendimiento para equipos de rugby amateur",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${anekTamil.variable} ${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
