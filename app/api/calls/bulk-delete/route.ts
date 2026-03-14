import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface BulkDeleteRequest {
  ids: string[];
}

/**
 * POST /api/calls/bulk-delete
 *
 * Soft delete multiple calls (admin only).
 * Sets deleted_at = NOW() for all specified calls.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify admin access
    await requireAdmin();
  } catch (error) {
    return NextResponse.json(
      { error: "Forbidden - Admin access required" },
      { status: 403 }
    );
  }

  try {
    const body: BulkDeleteRequest = await request.json();
    const { ids } = body;

    // 2. Validate input
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Bad Request - ids array required" },
        { status: 400 }
      );
    }

    if (ids.length > 100) {
      return NextResponse.json(
        { error: "Bad Request - Maximum 100 calls per batch" },
        { status: 400 }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const invalidIds = ids.filter(id => !uuidRegex.test(id));
    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "Bad Request - Invalid call ID format", invalidIds },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // 3. Check which calls exist and aren't already deleted
    const { data: existingCalls, error: fetchError } = await supabase
      .from("calls")
      .select("id, deleted_at")
      .in("id", ids);

    if (fetchError) {
      console.error("[BULK DELETE] Failed to fetch calls:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch calls", details: fetchError.message },
        { status: 500 }
      );
    }

    const existingIds = new Set(existingCalls?.map(c => c.id) || []);
    const alreadyDeletedIds = new Set(
      existingCalls?.filter(c => c.deleted_at).map(c => c.id) || []
    );
    const validIds = ids.filter(id => existingIds.has(id) && !alreadyDeletedIds.has(id));
    const notFoundIds = ids.filter(id => !existingIds.has(id));

    if (validIds.length === 0) {
      return NextResponse.json(
        {
          error: "No valid calls to delete",
          notFound: notFoundIds.length,
          alreadyDeleted: alreadyDeletedIds.size,
        },
        { status: 400 }
      );
    }

    // 4. Perform bulk soft delete
    const { error: updateError } = await supabase
      .from("calls")
      .update({ deleted_at: new Date().toISOString() })
      .in("id", validIds);

    if (updateError) {
      console.error("[BULK DELETE] Failed to soft delete:", updateError);
      return NextResponse.json(
        { error: "Failed to delete calls", details: updateError.message },
        { status: 500 }
      );
    }

    console.log(`[BULK DELETE] Soft deleted ${validIds.length} calls`);

    return NextResponse.json(
      {
        success: true,
        message: `Successfully deleted ${validIds.length} call${validIds.length !== 1 ? "s" : ""}`,
        deletedCount: validIds.length,
        deletedIds: validIds,
        notFound: notFoundIds,
        alreadyDeleted: Array.from(alreadyDeletedIds),
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[BULK DELETE] Unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error", details: err.message },
      { status: 500 }
    );
  }
}
