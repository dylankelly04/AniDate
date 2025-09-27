import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export async function POST(request: NextRequest) {
  try {
    const { userId, targetUserId, message } = await request.json();

    if (!userId || !targetUserId || !message) {
      return NextResponse.json(
        {
          error: "User ID, target user ID, and message are required",
        },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Send the message
    const { error: messageError } = await supabase.from("messages").insert({
      sender_id: userId,
      receiver_id: targetUserId,
      content: message,
      created_at: new Date().toISOString(),
    });

    if (messageError) {
      console.error("Error sending message:", messageError);
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 }
      );
    }

    // Update the waiting action to completed
    const { error: updateError } = await supabase
      .from("agent_actions")
      .update({
        status: "completed",
        action: `User responded to ${targetUserId}`,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId)
      .eq("target_user_id", targetUserId)
      .eq("status", "waiting_for_user");

    if (updateError) {
      console.error("Error updating agent action:", updateError);
      // Don't fail the request since the message was sent successfully
    }

    return NextResponse.json({
      success: true,
      message: "Response sent successfully",
    });
  } catch (error) {
    console.error("Error in respond endpoint:", error);
    return NextResponse.json(
      { error: "Failed to process response" },
      { status: 500 }
    );
  }
}
