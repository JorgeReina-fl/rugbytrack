export const HEALTH_CONSENT_VERSION = "2026-10-21";

interface ConsentLike {
  healthConsentAt: Date | null;
  healthConsentVersion: string | null;
}

/** Consentimiento de datos de salud dado y para la versión vigente del texto. */
export function hasCurrentConsent(user: ConsentLike | null | undefined): boolean {
  return !!user?.healthConsentAt && user.healthConsentVersion === HEALTH_CONSENT_VERSION;
}
