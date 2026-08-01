import Link from "next/link";
import Image from "next/image";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { LogoHorizontal } from "@/components/icons/Logo";
import { MobileNav } from "@/components/landing/MobileNav";

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

        {/* NAV LOCAL — punto 4: CTA primario "Empieza gratis" + "Iniciar sesión" outline secundario */}
        <nav className="flex flex-row items-center justify-between gap-3 py-4 md:py-6 px-4 md:px-8 border-b border-border">
          <Link href="/" className="flex-shrink-0">
            <LogoHorizontal size={32} />
          </Link>
          <div className="hidden md:flex items-center gap-8 font-mono text-sm uppercase tracking-tighter">
            <Link href="/" className="hover:text-primary transition-colors">Inicio</Link>
            <Link href="#features" className="hover:text-primary transition-colors">Características</Link>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Link href="/login" className="hidden md:inline-flex font-mono uppercase text-sm py-3 px-5 rounded-lg border border-border hover:border-primary hover:text-primary transition-colors whitespace-nowrap">
              Iniciar Sesión
            </Link>
            <Link href="/register" className="bg-primary text-primary-foreground font-mono uppercase text-xs md:text-sm py-2.5 md:py-3 px-3 md:px-6 rounded-lg hover:bg-foreground hover:text-background transition-colors whitespace-nowrap">
              Empieza Gratis
            </Link>
            <MobileNav />
          </div>
        </nav>

        {/* TITULAR GIGANTE HERO */}
        <div className="py-8 px-4 md:px-8 border-b border-border flex flex-col gap-6">
          <h1 className="font-heading font-extrabold text-5xl sm:text-7xl md:text-[110px] leading-[0.85] tracking-tighter uppercase break-words">
            Entrena Duro. <span className="text-primary">Rinde Mejor.</span>
          </h1>
          {/* punto 1: CTA primario hero */}
          <div>
            <Link href="/register" className="inline-block bg-primary text-primary-foreground font-mono uppercase text-sm py-4 px-8 rounded-lg hover:bg-foreground hover:text-background transition-colors">
              Empieza Gratis
            </Link>
          </div>
        </div>

        {/* GRID DIVIDIDO HERO */}
        <div className="grid grid-cols-1 md:grid-cols-2 border-b border-border">

          {/* Columna Izquierda */}
          <div className="flex flex-col border-r border-border">
            {/* punto 5: altura unificada h-72 object-cover */}
            <div className="h-72 w-full relative overflow-hidden">
              <Image src="/img-rugbytrack.webp" alt="Rugby entrenamiento" fill className="object-cover" />
            </div>
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
            {/* punto 5: altura unificada h-72 object-cover */}
            <div className="h-72 w-full relative overflow-hidden">
              <Image src="/img-rugbytrack2.jpg" alt="Rugby equipo" fill className="object-cover" />
            </div>
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
          <div className="aspect-[4/3] md:aspect-auto w-full md:min-h-[400px] relative overflow-hidden">
            <Image src="/img-rugbytrack3.jpg" alt="Rugby potencial" fill className="object-cover" />
          </div>
        </div>

        {/* CTA BANNER PÚRPURA — punto 2: titular + subtítulo + CTA "Prueba RugbyTrack gratis" */}
        <div className="relative text-primary-foreground p-12 md:p-24 flex flex-col items-center justify-center text-center gap-8 border-b border-border overflow-hidden">
          <Image src="/img-rugbytrack4.png" alt="Rugby comunidad" fill className="object-cover" />
          <div className="absolute inset-0 bg-primary/75" />
          <p className="relative z-10 font-mono text-sm uppercase tracking-widest font-semibold">Lo que creemos</p>
          <h2 className="relative z-10 font-heading font-bold text-5xl md:text-7xl leading-[0.9] tracking-tighter uppercase max-w-4xl">
            ¡Únete a la Tribu RugbyTrack Hoy!
          </h2>
          <p className="relative z-10 font-sans text-lg leading-relaxed max-w-xl text-primary-foreground/90">
            Gestiona entrenamientos, analiza el rendimiento de tu equipo y conecta con tu comunidad rugby en una sola plataforma.
          </p>
          <Link href="/register" className="relative z-10 mt-4 bg-background text-foreground font-mono uppercase text-sm py-4 px-8 rounded-lg hover:bg-secondary transition-colors">
            Prueba RugbyTrack Gratis
          </Link>
        </div>

        {/* FOOTER LOCAL (Según Figma) — punto 3: enlaces legales */}
        <footer className="flex flex-col bg-background">
          <div className="grid grid-cols-1 md:grid-cols-2 px-6 py-10 md:p-16 gap-10 md:gap-8">
            {/* Logo Area */}
            <div className="flex justify-center md:justify-start items-start">
              <LogoHorizontal size={56} />
            </div>

            {/* Links Area */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-center sm:text-left">
              <div className="flex flex-col gap-3 items-center sm:items-start">
                <h5 className="font-heading font-bold text-lg uppercase">Contacto</h5>
                <div className="flex flex-col gap-1 font-sans text-xs font-medium">
                  <a href="mailto:rugbytrack@mivia.es" className="hover:underline break-all">rugbytrack@mivia.es</a>
                  <span>+34 600 000 000</span>
                </div>
              </div>
              <div className="flex flex-col gap-3 items-center sm:items-start">
                <h5 className="font-heading font-bold text-lg uppercase">Horarios</h5>
                <div className="flex flex-col gap-1 font-mono text-xs uppercase tracking-tighter w-full max-w-[140px]">
                  <div className="flex justify-between"><span>Lun-Vie</span><span>09-22h</span></div>
                  <div className="flex justify-between"><span>Sáb-Dom</span><span>08-15h</span></div>
                </div>
              </div>
              <div className="flex flex-col gap-3 items-center sm:items-start col-span-2 sm:col-span-1">
                <h5 className="font-heading font-bold text-lg uppercase">Redes</h5>
                <div className="flex flex-col gap-1 font-sans text-xs underline font-medium">
                  <a href="#" className="hover:text-primary">Instagram</a>
                  <a href="#" className="hover:text-primary">X (Twitter)</a>
                  <a href="#" className="hover:text-primary">Spotify</a>
                </div>
              </div>
            </div>
          </div>

          {/* Legal links */}
          <div className="border-t border-border px-6 md:px-16 py-6 flex flex-wrap gap-3 md:gap-6 items-center justify-center md:justify-start text-center">
            <span className="font-mono text-xs text-muted-foreground uppercase tracking-tighter">© {new Date().getFullYear()} RugbyTrack</span>
            <Link href="/legal" className="font-mono text-xs text-muted-foreground uppercase tracking-tighter hover:text-primary transition-colors">Aviso Legal</Link>
            <Link href="/terminos" className="font-mono text-xs text-muted-foreground uppercase tracking-tighter hover:text-primary transition-colors">Términos y Condiciones</Link>
            <Link href="/privacidad" className="font-mono text-xs text-muted-foreground uppercase tracking-tighter hover:text-primary transition-colors">Política de Privacidad</Link>
          </div>
        </footer>

      </div>
    </div>
  );
}
