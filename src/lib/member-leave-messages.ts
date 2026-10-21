const DATA_LIST = "asistencia, RPE, molestias, votos y apoyos";

export const LEAVE_DATA_WARNING = `Al salir se borrarán tus datos en este equipo: ${DATA_LIST}. Tus mensajes del foro quedarán como «Ex-miembro». No se puede deshacer.`;

export const kickDataWarning = (name: string) =>
  `Se borrarán los datos de ${name} en este equipo: ${DATA_LIST}. Sus mensajes del foro quedarán como «Ex-miembro». No se puede deshacer.`;
