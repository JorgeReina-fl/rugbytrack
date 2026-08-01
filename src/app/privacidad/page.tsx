import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Privacidad — RugbyTrack",
  description:
    "Política de privacidad y cookies de RugbyTrack: datos tratados, finalidad, base legal, conservación y derechos RGPD.",
};

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center">
      <div className="w-full max-w-[1200px] flex flex-col relative border-x border-border">
        <nav className="flex items-center justify-between py-6 px-8 border-b border-border">
          <Link href="/" className="font-heading font-bold text-2xl tracking-tighter">RugbyTrack</Link>
          <Link href="/" className="font-mono text-sm uppercase tracking-tighter hover:text-primary transition-colors">← Volver</Link>
        </nav>

        <article className="p-8 md:p-16 flex flex-col gap-8 max-w-3xl">
          <header className="flex flex-col gap-3">
            <h1 className="font-heading font-extrabold text-5xl uppercase tracking-tighter">Política de Privacidad</h1>
            <p className="font-mono text-xs uppercase tracking-tighter text-muted-foreground">
              Última actualización: 1 de agosto de 2026
            </p>
          </header>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">1. Responsable del tratamiento</h2>
            <ul className="font-sans text-base leading-relaxed text-foreground/90 list-disc pl-6 flex flex-col gap-1">
              <li><strong>Responsable:</strong> Jorge Luis Reina Guamán</li>
              <li><strong>NIF/CIF:</strong> 78249988D</li>
              <li><strong>Domicilio:</strong> Calle Mariano Luiña 27, 03202 Elche, Alicante</li>
              <li><strong>Correo electrónico:</strong> <a href="mailto:rugbytrack@mivia.es" className="underline hover:text-primary">rugbytrack@mivia.es</a></li>
              <li><strong>Teléfono:</strong> <a href="tel:+34865782210" className="underline hover:text-primary">+34 865 782 210</a></li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">2. Datos que tratamos</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              En función de tu interacción con RugbyTrack tratamos, como máximo, las siguientes categorías de datos:
            </p>
            <ul className="font-sans text-base leading-relaxed text-foreground/90 list-disc pl-6 flex flex-col gap-1">
              <li><strong>Datos de cuenta:</strong> nombre, dirección de correo electrónico y rol (entrenador o jugador).</li>
              <li><strong>Datos deportivos:</strong> asistencia a entrenamientos y eventos, métricas de esfuerzo percibido (RPE) y estadísticas derivadas.</li>
              <li><strong>Contenidos de usuario:</strong> mensajes publicados en el foro del equipo e imágenes que decidas subir.</li>
              <li><strong>Datos técnicos mínimos:</strong> los registros necesarios para operar el servicio de forma segura (cookie de sesión, marcas de tiempo de acceso).</li>
            </ul>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              No solicitamos ni tratamos de forma intencionada categorías especiales de datos (por ejemplo, datos de salud detallados).
              El RPE se trata como métrica deportiva de esfuerzo subjetivo, no como diagnóstico médico.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">3. Finalidad y base legal</h2>
            <ul className="font-sans text-base leading-relaxed text-foreground/90 list-disc pl-6 flex flex-col gap-2">
              <li>
                <strong>Prestación del servicio</strong> (gestión de cuenta, equipos, convocatorias, asistencia, métricas, foro):
                ejecución de un contrato en el que el interesado es parte (art. 6.1.b RGPD).
              </li>
              <li>
                <strong>Seguridad, prevención de abusos y registros de acceso:</strong>
                interés legítimo del responsable en garantizar la seguridad e integridad del servicio (art. 6.1.f RGPD).
              </li>
              <li>
                <strong>Cumplimiento de obligaciones legales</strong> (por ejemplo, atender requerimientos de autoridades competentes):
                art. 6.1.c RGPD.
              </li>
              <li>
                <strong>Comunicaciones operativas</strong> relativas al servicio (avisos de seguridad, cambios sustanciales en los términos):
                ejecución del contrato. No se realizan comunicaciones comerciales sin consentimiento previo.
              </li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">4. Plazos de conservación</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              Los datos se conservan mientras la cuenta permanezca activa y el usuario no solicite su supresión.
              Cuando la cuenta se cancele, los datos personales se eliminarán o anonimizarán en un plazo razonable,
              salvo aquellos que deban conservarse bloqueados para atender posibles responsabilidades legales durante los plazos
              previstos por la normativa aplicable.
              Las copias de seguridad se rotan periódicamente y los datos eliminados desaparecen con la caducidad natural de las mismas.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">5. Destinatarios</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              Los datos son tratados en la infraestructura propia del responsable (hosting autogestionado).
              No cedemos datos a terceros con fines comerciales ni publicitarios y no realizamos transferencias internacionales.
              Los únicos accesos de terceros posibles son los que puedan derivarse de requerimientos legales de autoridades competentes
              o los que resulten estrictamente necesarios para el mantenimiento técnico del sistema, bajo el correspondiente deber de confidencialidad.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">6. Derechos del usuario</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              De acuerdo con el RGPD y la LOPDGDD, puedes ejercer en cualquier momento los derechos de{" "}
              <strong>acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad</strong> (ARSOPOL),
              así como el derecho a no ser objeto de decisiones automatizadas con efectos jurídicos.
            </p>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              Para ejercerlos, envía una solicitud a{" "}
              <a href="mailto:rugbytrack@mivia.es" className="underline hover:text-primary">rugbytrack@mivia.es</a>{" "}
              indicando el derecho que deseas ejercer y acompañando, si es preciso, un documento que acredite tu identidad.
              Atenderemos tu solicitud en el plazo máximo previsto por la normativa.
              Si consideras que el tratamiento no es conforme a la normativa, puedes presentar una reclamación ante la
              Agencia Española de Protección de Datos (<a href="https://www.aepd.es" target="_blank" rel="noopener" className="underline hover:text-primary">www.aepd.es</a>).
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">7. Medidas de seguridad</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              Aplicamos medidas técnicas y organizativas apropiadas para proteger los datos frente a accesos no autorizados, pérdida o alteración:
              cifrado en tránsito (HTTPS/TLS), autenticación mediante contraseñas resumidas con algoritmos robustos,
              control de accesos por rol dentro de cada equipo, aislamiento de la base de datos y realización periódica de copias de seguridad.
              El acceso a los sistemas está restringido al personal técnico estrictamente necesario, sujeto a deber de confidencialidad.
            </p>
          </section>

          <section id="cookies" className="flex flex-col gap-3 scroll-mt-24">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">8. Política de cookies</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              RugbyTrack utiliza <strong>únicamente cookies técnicas propias</strong> estrictamente necesarias para el funcionamiento del servicio,
              en concreto para mantener la sesión iniciada del usuario tras autenticarse (cookies de sesión gestionadas por NextAuth).
            </p>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              Estas cookies están <strong>exentas del deber de consentimiento previo</strong> conforme al artículo 22.2 de la LSSI-CE
              y a las directrices de la Agencia Española de Protección de Datos, por tratarse de cookies imprescindibles para prestar
              un servicio expresamente solicitado por el usuario.
            </p>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              <strong>No utilizamos</strong> cookies de analítica, de perfilado ni publicitarias, ni cookies de terceros.
              Si en el futuro se incorporaran, se solicitará el consentimiento correspondiente y se actualizará esta política.
              Puedes bloquear o eliminar las cookies desde la configuración de tu navegador, pero en tal caso es posible que no puedas
              mantener la sesión iniciada ni utilizar las funciones que requieren autenticación.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-heading font-bold text-2xl uppercase tracking-tight">9. Cambios en esta política</h2>
            <p className="font-sans text-base leading-relaxed text-foreground/90">
              Podemos actualizar esta política para adaptarla a novedades legislativas, técnicas o funcionales del servicio.
              La versión vigente estará siempre disponible en esta página con su fecha de actualización.
              Cuando los cambios afecten de forma sustancial al tratamiento, se comunicarán por los medios habituales de contacto.
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
