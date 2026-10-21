import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { HEALTH_CONSENT_VERSION } from "@/lib/health-consent";
import { apiUnauthorized, handleUnknownError } from "@/lib/api-response";

/** POST /api/me/health-consent — el usuario da su consentimiento explícito de datos de salud. */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();
    const userId = session.user.id;

    await prisma.user.update({
      where: { id: userId },
      data: { healthConsentAt: new Date(), healthConsentVersion: HEALTH_CONSENT_VERSION },
    });
    logger.info({ userId, version: HEALTH_CONSENT_VERSION }, "Health consent given");

    return NextResponse.json({ version: HEALTH_CONSENT_VERSION });
  } catch (error) {
    return handleUnknownError(error, "POST /api/me/health-consent");
  }
}

/** DELETE /api/me/health-consent — retira el consentimiento y borra TODAS sus molestias. */
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();
    const userId = session.user.id;

    const [removed] = await prisma.$transaction([
      prisma.discomfort.deleteMany({ where: { userId } }),
      prisma.user.update({ where: { id: userId }, data: { healthConsentAt: null, healthConsentVersion: null } }),
    ]);
    logger.info({ userId, deleted: removed.count }, "Health consent withdrawn");

    return NextResponse.json({ deleted: removed.count });
  } catch (error) {
    return handleUnknownError(error, "DELETE /api/me/health-consent");
  }
}
