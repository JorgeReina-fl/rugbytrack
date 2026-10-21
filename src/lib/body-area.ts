import type { BodyArea } from "@prisma/client";

export const BODY_AREA_LABELS: Record<BodyArea, string> = {
  HEAD: "Cabeza",
  NECK: "Cuello",
  SHOULDER: "Hombro",
  ARM_ELBOW: "Brazo/codo",
  WRIST_HAND: "Muñeca/mano",
  UPPER_BACK: "Espalda alta",
  LOWER_BACK: "Espalda baja",
  HIP_GROIN: "Cadera/ingle",
  THIGH: "Muslo",
  KNEE: "Rodilla",
  CALF_LEG: "Gemelo/pierna",
  ANKLE_FOOT: "Tobillo/pie",
  OTHER: "Otra",
};

export const BODY_AREAS = Object.keys(BODY_AREA_LABELS) as BodyArea[];
