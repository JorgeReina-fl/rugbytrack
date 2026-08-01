import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso Legal — RugbyTrack",
  description:
    "Aviso legal de RugbyTrack: identificación del titular, condiciones de uso, propiedad intelectual y ley aplicable.",
};

export default function LegalPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
      <div className="w-full max-w-[1200px] flex flex-col relative border-x border-border">
        <nav className="flex items-center justify-between py-6 px-8 border-b border-border">
          <Link href="/" className="font-heading font-bold text-2xl tracking-tighter">RugbyTrack</Link>
          <Link href="/" className="font-mono text-sm uppercase tracking-tighter hover:text-primary transition-colors">← Volver</Link>
        </nav>

        <article className="p-8 md:p-16 flex flex-col gap-8 max-w-3xl">
          <header className="flex flex-col gap-3">
            <h1 className="font-heading font-extrabold text-5xl uppercase tracking-tighter">Aviso Legal</h1>
            <p className="font-mono text-xs uppercase tracking-tighter text-muted-foreground">
              Última actualización: 1 de agosto de 2026
            </p>
          </header>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">1. Identificación del titular</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              En cumplimiento de la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI-CE),
              se informa al usuario de los siguientes datos del titular del sitio web y de la plataforma RugbyTrack:
            </p>
            <ul className="font-sans text-base leading-relaxed text-foreground/90 list-disc pl-6 flex flex-col gap-1">
              <li><strong>Titular:</strong> Jorge Luis Reina Guamán</li>
              <li><strong>NIF/CIF:</strong> 78249988D</li>
              <li><strong>Domicilio:</strong> Calle Mariano Luiña 27, 03202 Elche, Alicante</li>
              <li><strong>Marca comercial:</strong> RugbyTrack, operada bajo el proyecto mivia.es</li>
              <li><strong>Correo electrónico:</strong> <a href="mailto:rugbytrack@mivia.es" className="underline hover:text-primary">rugbytrack@mivia.es</a></li>
              <li><strong>Teléfono:</strong> <a href="tel:+34865782210" className="underline hover:text-primary">+34 865 782 210</a></li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">2. Objeto</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              El presente aviso legal regula el acceso, la navegación y el uso del sitio web y de la plataforma RugbyTrack (en adelante, “la Plataforma”),
              cuyo objeto es ofrecer herramientas de gestión y seguimiento del rendimiento deportivo para equipos de rugby amateur:
              gestión de plantillas, convocatorias y asistencia, registro de métricas de esfuerzo percibido (RPE), estadísticas de equipo y foro interno.
            </p>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              El acceso a la Plataforma atribuye la condición de usuario e implica la aceptación plena y sin reservas de este aviso legal,
              de los <Link href="/terminos" className="underline hover:text-primary">Términos y Condiciones</Link> y de la{" "}
              <Link href="/privacidad" className="underline hover:text-primary">Política de Privacidad</Link>.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">3. Condiciones de uso</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              El usuario se compromete a hacer un uso diligente y lícito de la Plataforma, absteniéndose de:
            </p>
            <ul className="font-sans text-base leading-relaxed text-foreground/90 list-disc pl-6 flex flex-col gap-1">
              <li>Utilizarla con fines contrarios a la ley, a la moral o al orden público.</li>
              <li>Introducir contenidos difamatorios, ofensivos, discriminatorios o que infrinjan derechos de terceros.</li>
              <li>Alterar, dañar o interferir el funcionamiento de la Plataforma, sus sistemas o los datos alojados en ella.</li>
              <li>Suplantar la identidad de otros usuarios o acceder a cuentas ajenas sin autorización.</li>
              <li>Realizar ingeniería inversa, extracción masiva de datos (<em>scraping</em>) o accesos automatizados no autorizados.</li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">4. Propiedad intelectual e industrial</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              Todos los contenidos de la Plataforma —código fuente, diseño, estructura de navegación, textos, gráficos, logotipos, iconos e imágenes—
              son titularidad del titular indicado en el apartado 1 o cuentan con la correspondiente autorización para su uso.
              Queda prohibida su reproducción, distribución, comunicación pública, transformación o cualquier otra forma de explotación
              sin autorización previa y expresa por escrito.
            </p>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              Los contenidos aportados por los usuarios (mensajes de foro, imágenes, datos de entrenamiento) siguen siendo de su titularidad,
              conforme a lo previsto en los Términos y Condiciones.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">5. Limitación de responsabilidad</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              El titular no garantiza la disponibilidad continua e ininterrumpida de la Plataforma y no será responsable de los daños o perjuicios
              derivados de interrupciones, errores u omisiones, fallos de conexión, ataques informáticos o causas de fuerza mayor.
              Tampoco responde de los contenidos publicados por los usuarios ni de los enlaces a sitios de terceros a los que pueda dirigir la Plataforma.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">6. Legislación aplicable y jurisdicción</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              El presente aviso legal se rige por la legislación española. Para cualquier controversia derivada del acceso o uso de la Plataforma,
              las partes se someten, con renuncia expresa a cualquier otro fuero, a los juzgados y tribunales del domicilio del titular,
              sin perjuicio de los derechos que la normativa de consumo reconozca al usuario consumidor.
            </p>
          </section>
        </article>

        <footer className="border-t border-border px-6 md:px-16 py-6 flex flex-wrap gap-3 md:gap-6 items-center justify-center md:justify-start text-center">
          <span className="font-mono text-xs text-muted-foreground uppercase tracking-tighter">© {new Date().getFullYear()} RugbyTrack</span>
          <Link href="/legal" className="font-mono text-xs text-muted-foreground uppercase tracking-tighter hover:text-primary transition-colors">Aviso Legal</Link>
          <Link href="/terminos" className="font-mono text-xs text-muted-foreground uppercase tracking-tighter hover:text-primary transition-colors">Términos y Condiciones</Link>
          <Link href="/privacidad" className="font-mono text-xs text-muted-foreground uppercase tracking-tighter hover:text-primary transition-colors">Política de Privacidad</Link>
        </footer>
      </div>
    </div>
  );
}
