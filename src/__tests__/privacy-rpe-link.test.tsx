/**
 * @jest-environment node
 */

import { renderToStaticMarkup } from "react-dom/server";
import PrivacidadPage from "@/app/privacidad/page";

const text = () => renderToStaticMarkup(<PrivacidadPage />).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("/privacidad — enlaces de RPE por email", () => {
  test("describe el enlace personal, las 48 horas y el carácter del email", () => {
    const t = text();
    expect(t).toContain("enlace personal");
    expect(t).toContain("48 horas");
    expect(t).toContain("no requiere iniciar sesión");
    expect(t).toContain("No debes reenviarlo");
    expect(t).toContain("no se puede desactivar desde las preferencias de notificaciones");
    expect(t).toContain("el entrenador sí puede desactivar el envío automático para su equipo");
  });

  test("fecha de última actualización y sin tocar el texto de salud ni el encargado Resend", () => {
    const t = text();
    expect(t).toContain("Última actualización: 27 de octubre de 2026");
    expect(t).toContain("El RPE se trata como métrica deportiva de esfuerzo subjetivo, no como diagnóstico médico.");
    expect(t).toContain("Resend (envío de correos)");
  });
});
