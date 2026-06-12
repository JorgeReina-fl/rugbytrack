import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RugbyTrack — Entrena Duro. Rinde Mejor.",
  description: "Plataforma de gestión y rendimiento para equipos de rugby amateur",
};

export default async function HomePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
      {/* Contenedor central limitado a 1200px de ancho simulando la estructura del Figma */}
      <div className="w-full max-w-[1200px] flex flex-col relative border-x border-border">
        
        {/* NAV LOCAL */}
        <nav className="flex flex-row items-center justify-between py-6 px-8 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
               {/* Recreación de Logo con Círculos */}
               <div className="flex -space-x-2">
                 <div className="w-4 h-4 rounded-full bg-foreground opacity-50"></div>
                 <div className="w-6 h-6 rounded-full bg-foreground opacity-80 z-10"></div>
                 <div className="w-8 h-8 rounded-full bg-foreground z-20"></div>
               </div>
               <span className="font-heading font-bold text-2xl tracking-tighter">RugbyTrack</span>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-8 font-mono text-sm uppercase tracking-tighter">
            <Link href="/" className="hover:text-primary transition-colors">Inicio</Link>
            <Link href="#features" className="hover:text-primary transition-colors">Características</Link>
          </div>
          <Link href="/login" className="bg-primary text-primary-foreground font-mono uppercase text-sm py-3 px-6 rounded-lg hover:bg-foreground hover:text-background transition-colors">
            Iniciar Sesión
          </Link>
        </nav>

        {/* TITULAR GIGANTE HERO */}
        <div className="py-8 px-8 border-b border-border">
          <h1 className="font-heading font-extrabold text-7xl md:text-[110px] leading-[0.85] tracking-tighter uppercase break-words">
            Entrena Duro. <span className="text-primary">Rinde Mejor.</span>
          </h1>
        </div>

        {/* GRID DIVIDIDO HERO */}
        <div className="grid grid-cols-1 md:grid-cols-2 border-b border-border">
          
          {/* Columna Izquierda */}
          <div className="flex flex-col border-r border-border">
            {/* Placeholder de imagen con Gradiente de Tokens */}
            <div className="aspect-[4/3] bg-gradient-to-br from-primary to-secondary w-full"></div>
            {/* Bloque de Texto */}
            <div className="p-8 flex flex-col gap-4 flex-1">
              <h2 className="font-heading font-bold text-4xl uppercase tracking-tight">Guiado por Expertos</h2>
              <p className="font-sans text-base leading-relaxed max-w-sm text-foreground/80">
                Creemos en crear un entorno positivo donde tu equipo pueda prosperar. Estamos aquí para ayudarte a alcanzar tus metas de rendimiento deportivo y desbloquear tu potencial.
              </p>
            </div>
          </div>

          {/* Columna Derecha */}
          <div className="flex flex-col">
            {/* Top Text */}
            <div className="p-8 border-b border-border grid grid-cols-1 sm:grid-cols-2 gap-8">
               <h3 className="font-heading font-bold text-3xl uppercase tracking-tight">Para Comprometidos</h3>
               <p className="font-sans text-sm leading-relaxed text-foreground/80">
                 Entrena como un atleta de élite con seguimiento de alto nivel. Ya sea analizando cargas o rompiendo RPs, te ayudamos a superar tus límites en el campo.
               </p>
            </div>
            {/* Placeholder de imagen intermedio */}
            <div className="aspect-[2/1] bg-gradient-to-tr from-secondary to-primary w-full"></div>
            {/* Bottom Text */}
            <div className="p-8 flex flex-col gap-4">
              <h2 className="font-heading font-bold text-4xl uppercase tracking-tight">Análisis Dinámico</h2>
              <p className="font-sans text-base leading-relaxed max-w-sm text-foreground/80">
                Nuestra plataforma elimina el ruido y se centra en los datos fundamentales. Nuestro panel te guía a través de métricas RPE para construir un equipo invencible.
              </p>
            </div>
          </div>

        </div>

        {/* BANNER CENTRAL */}
        <div className="py-6 px-8 border-b border-border">
          <h2 className="font-heading font-bold text-6xl md:text-8xl leading-none tracking-tighter uppercase text-primary">
            Únete a la <span className="text-primary/50">Comunidad</span>
          </h2>
        </div>

        {/* DISCOVER POTENTIAL SPLIT */}
        <div className="grid grid-cols-1 md:grid-cols-2 border-b border-border">
          {/* Left: Lista de Funcionalidades */}
          <div className="p-8 border-r border-border flex flex-col gap-12">
            <h3 className="font-heading font-bold text-4xl uppercase tracking-tight">Desbloquea tu Potencial</h3>
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-2">
                <h4 className="font-heading font-bold text-xl uppercase tracking-tight">Control de RPE</h4>
                <p className="font-sans text-sm text-muted-foreground">Monitoreo que mide esfuerzo tangible en tus jugadores jornada a jornada.</p>
              </div>
              <div className="w-full h-px bg-border"></div>
              <div className="flex flex-col gap-2">
                <h4 className="font-heading font-bold text-xl uppercase tracking-tight">Estadísticas en Vivo</h4>
                <p className="font-sans text-sm text-muted-foreground">Métricas centradas en resultados de asistencia, faltas y evolución deportiva.</p>
              </div>
              <div className="w-full h-px bg-border"></div>
              <div className="flex flex-col gap-2">
                <h4 className="font-heading font-bold text-xl uppercase tracking-tight">Foro de Equipo</h4>
                <p className="font-sans text-sm text-muted-foreground">Una tribu unida. Comunícate en tiempo real y planea estrategias con todos.</p>
              </div>
            </div>
            <div className="mt-4">
              <Link href="/login" className="font-mono text-sm uppercase tracking-tighter hover:text-primary transition-colors">
                Ver Funciones →
              </Link>
            </div>
          </div>
          {/* Right: Imagen Full */}
          <div className="bg-gradient-to-bl from-foreground to-primary aspect-square md:aspect-auto w-full min-h-[400px]"></div>
        </div>

        {/* CTA BANNER PÚRPURA */}
        <div className="bg-primary text-primary-foreground p-12 md:p-24 flex flex-col items-center justify-center text-center gap-8 border-b border-border">
          <p className="font-mono text-sm uppercase tracking-widest font-semibold">Lo que creemos</p>
          <h2 className="font-heading font-bold text-5xl md:text-7xl leading-[0.9] tracking-tighter uppercase max-w-4xl">
            ¡Únete a la Tribu RugbyTrack Hoy!
          </h2>
          <Link href="/login" className="mt-4 bg-background text-foreground font-mono uppercase text-sm py-4 px-8 rounded-lg hover:bg-secondary transition-colors">
            Iniciar Sesión
          </Link>
        </div>

        {/* FOOTER LOCAL (Según Figma) */}
        <footer className="grid grid-cols-1 md:grid-cols-2 p-12 md:p-16 gap-16 md:gap-8 bg-background">
          {/* Logo Area */}
          <div className="flex items-start">
             <div className="flex items-center gap-2">
               {/* 3 circles logo grande */}
               <div className="flex -space-x-4">
                 <div className="w-10 h-10 rounded-full bg-foreground opacity-50"></div>
                 <div className="w-14 h-14 rounded-full bg-foreground opacity-80 z-10"></div>
                 <div className="w-20 h-20 rounded-full bg-foreground z-20"></div>
               </div>
               <span className="font-heading font-bold text-4xl md:text-5xl tracking-tighter ml-4">RugbyTrack</span>
             </div>
          </div>

          {/* Links Area */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            <div className="flex flex-col gap-4">
              <h5 className="font-heading font-bold text-lg uppercase">Contacto</h5>
              <div className="flex flex-col gap-1 font-sans text-xs font-medium">
                <a href="#" className="hover:underline">soporte@rugbytrack.es</a>
                <span>+34 600 000 000</span>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <h5 className="font-heading font-bold text-lg uppercase">Horarios</h5>
              <div className="flex flex-col gap-1 font-mono text-xs uppercase tracking-tighter">
                <div className="flex justify-between w-full max-w-[120px]"><span>Lun-Vie</span><span>09:00 - 22:00</span></div>
                <div className="flex justify-between w-full max-w-[120px]"><span>Sáb-Dom</span><span>08:00 - 15:00</span></div>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <h5 className="font-heading font-bold text-lg uppercase">Redes</h5>
              <div className="flex flex-col gap-1 font-sans text-xs underline font-medium">
                <a href="#" className="hover:text-primary">Instagram</a>
                <a href="#" className="hover:text-primary">X (Twitter)</a>
                <a href="#" className="hover:text-primary">Spotify</a>
              </div>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
