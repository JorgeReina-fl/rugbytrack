import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Términos y Condiciones — RugbyTrack",
  description:
    "Términos y condiciones de uso de la plataforma RugbyTrack: cuentas, obligaciones, contenidos de usuario y cancelación.",
};

export default function TerminosPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
      <div className="w-full max-w-[1200px] flex flex-col relative border-x border-border">
        <nav className="flex items-center justify-between py-6 px-8 border-b border-border">
          <Link href="/" className="font-heading font-bold text-2xl tracking-tighter">RugbyTrack</Link>
          <Link href="/" className="font-mono text-sm uppercase tracking-tighter hover:text-primary transition-colors">← Volver</Link>
        </nav>

        <article className="p-8 md:p-16 flex flex-col gap-8 max-w-3xl">
          <header className="flex flex-col gap-3">
            <h1 className="font-heading font-extrabold text-5xl uppercase tracking-tighter">Términos y Condiciones</h1>
            <p className="font-mono text-xs uppercase tracking-tighter text-muted-foreground">
              Última actualización: 1 de agosto de 2026
            </p>
          </header>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">1. Descripción del servicio</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              RugbyTrack es una plataforma web de gestión y seguimiento del rendimiento deportivo destinada a equipos de rugby amateur.
              Permite crear y administrar equipos, convocar eventos y entrenamientos, registrar asistencia, capturar métricas de esfuerzo
              percibido (RPE), consultar estadísticas y participar en un foro interno entre miembros del mismo equipo.
              El servicio se presta a través del sitio web operado bajo mivia.es.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">2. Registro y cuentas</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              Para acceder a las funcionalidades es necesario crear una cuenta facilitando, al menos, un nombre, una dirección de correo
              electrónico y el rol dentro del equipo (entrenador o jugador). El usuario garantiza que la información aportada es veraz y
              se compromete a mantenerla actualizada.
            </p>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              La cuenta es personal e intransferible. El usuario es responsable de la custodia de sus credenciales y de toda actividad
              realizada desde su cuenta. Debe comunicar de inmediato cualquier uso no autorizado a{" "}
              <a href="mailto:rugbytrack@mivia.es" className="underline hover:text-primary">rugbytrack@mivia.es</a>.
              Los menores de edad únicamente podrán registrarse con el consentimiento verificable de sus padres o tutores legales.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">3. Obligaciones del usuario</h2>
            <ul className="font-sans text-base leading-relaxed text-foreground/90 list-disc pl-6 flex flex-col gap-1">
              <li>Utilizar la Plataforma conforme a la ley, a la moral, al orden público y a estos términos.</li>
              <li>No suplantar la identidad de otras personas ni acceder a cuentas o equipos ajenos.</li>
              <li>No introducir contenidos ilícitos, difamatorios, discriminatorios, violentos o que vulneren derechos de terceros.</li>
              <li>No realizar acciones que puedan dañar, sobrecargar o inutilizar la Plataforma o los sistemas que la soportan.</li>
              <li>Respetar la confidencialidad de los datos a los que pueda acceder por su rol dentro del equipo.</li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">4. Contenidos generados por usuarios</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              El usuario conserva la titularidad de los contenidos que aporta (mensajes del foro, imágenes, datos de entrenamiento, comentarios).
              Al publicarlos, concede a RugbyTrack una licencia gratuita, no exclusiva y limitada al ámbito estrictamente necesario
              para prestar el servicio: almacenarlos, mostrarlos a los demás miembros del equipo y realizar copias de seguridad.
            </p>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              El usuario declara ser titular de los derechos sobre los contenidos que publica —en particular, sobre las imágenes—
              y contar con el consentimiento de las personas identificables que aparezcan en ellas.
              RugbyTrack podrá retirar, sin previo aviso, cualquier contenido que resulte ilícito o infrinja estos términos,
              y podrá suspender o cancelar la cuenta responsable en caso de infracción grave o reiterada.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">5. Disponibilidad del servicio</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              RugbyTrack pone los medios razonables para mantener la Plataforma disponible de forma continua, pero no puede garantizar la
              ausencia de interrupciones derivadas de mantenimientos, incidencias técnicas, actualizaciones o causas de fuerza mayor.
              El servicio se presta “tal cual” y podrá evolucionar mediante la incorporación, modificación o retirada de funcionalidades.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">6. Modificaciones</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              RugbyTrack podrá modificar estos términos para adaptarlos a cambios legales, técnicos o funcionales del servicio.
              La versión vigente se publicará siempre en esta página con su fecha de actualización.
              Cuando los cambios sean sustanciales, se comunicarán con antelación razonable a través del correo electrónico asociado a la cuenta.
              El uso continuado de la Plataforma tras la entrada en vigor de las modificaciones implicará su aceptación.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">7. Cancelación</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              El usuario puede solicitar la cancelación de su cuenta en cualquier momento escribiendo a{" "}
              <a href="mailto:rugbytrack@mivia.es" className="underline hover:text-primary">rugbytrack@mivia.es</a>.
              La cancelación conllevará el cese del acceso al servicio y la eliminación o anonimización de los datos personales asociados,
              con las salvedades previstas en la <Link href="/privacidad" className="underline hover:text-primary">Política de Privacidad</Link>.
            </p>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              RugbyTrack podrá cancelar o suspender cuentas en caso de incumplimiento de estos términos, de la normativa aplicable
              o cuando existan indicios razonables de uso fraudulento o abusivo del servicio.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">8. Legislación aplicable</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              Estos términos se rigen por la legislación española. Cualquier controversia se someterá a los juzgados y tribunales del
              domicilio del titular, sin perjuicio de los derechos reconocidos a los usuarios consumidores por la normativa aplicable.
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
