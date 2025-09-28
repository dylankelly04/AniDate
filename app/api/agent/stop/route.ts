import { NextRequest, NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Use service role client for server-side operations
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Set agent as inactive in the database
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ agent_active: false })
      .eq("id", userId);

    if (updateError) {
      console.error("Error setting agent as inactive:", updateError);
      return NextResponse.json(
        { error: "Failed to deactivate agent" },
        { status: 500 }
      );
    }

    console.log(`✅ Agent stopped for user: ${userId}`);

    return NextResponse.json({
      success: true,
      message: "Agent stopped successfully",
    });
  } catch (error) {
    console.error("Error stopping agent:", error);
    return NextResponse.json(
      { error: "Failed to stop agent" },
      { status: 500 }
    );
  }
}
