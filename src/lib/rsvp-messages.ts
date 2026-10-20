export function rsvpErrorMessage(httpStatus: number | null): string {
  switch (httpStatus) {
    case 401:
      return "El enlace no es válido o ha caducado";
    case 403:
      return "Ya no formas parte del equipo";
    case 409:
      return "El plazo para responder ha terminado";
    case 429:
      return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo";
    default:
      return "No se pudo guardar tu respuesta. Inténtalo de nuevo";
  }
}
