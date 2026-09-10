import "server-only";
import { auth } from "@/auth";
import { getProfileData } from "@/lib/profile";
import {
  apiSuccess,
  apiUnauthorized,
  apiNotFound,
  handleUnknownError,
} from "@/lib/api-response";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiUnauthorized();

    const data = await getProfileData(session.user.id);
    if (!data) return apiNotFound("Usuario");

    return apiSuccess(data);
  } catch (err) {
    return handleUnknownError(err, "GET /api/profile");
  }
}
