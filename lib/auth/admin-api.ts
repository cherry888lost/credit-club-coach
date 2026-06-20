import { NextResponse } from "next/server";
import { requireAdmin, type CurrentUser } from "@/lib/auth";

export async function requireAdminApi(): Promise<{ user: CurrentUser; response: null } | { user: null; response: NextResponse }> {
  try {
    const user = await requireAdmin();
    return { user, response: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unauthorized";
    const status = message.includes("Admin access required") ? 403 : 401;
    return {
      user: null,
      response: NextResponse.json(
        { error: status === 403 ? "Admin access required" : "Unauthorized" },
        { status }
      ),
    };
  }
}
