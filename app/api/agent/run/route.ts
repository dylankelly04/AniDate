import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

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

    // Check if agent is active for this user
    const { data: activeAgent } = await supabase
      .from("agent_actions")
      .select("*")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!activeAgent) {
      return NextResponse.json({
        success: false,
        message: "No active agent found",
      });
    }

    // Process existing matches to send messages
    await processExistingMatches(userId, supabase);

    return NextResponse.json({
      success: true,
      message: "Agent run completed",
    });
  } catch (error) {
    console.error("Error running agent:", error);
    return NextResponse.json({ error: "Failed to run agent" }, { status: 500 });
  }
}

async function processExistingMatches(userId: string, supabase: any) {
  try {
    // Get user preferences
    const { data: preferences } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!preferences) {
      console.error("No user preferences found");
      return;
    }

    // Use the EXACT same query as the matches page
    const { data: matches, error: matchesError } = await supabase
      .from("matches")
      .select(
        `
        *,
        user1_profile:profiles!matches_user1_id_fkey(
          id,
          full_name,
          age,
          location,
          bio,
          avatar_url,
          interests
        ),
        user2_profile:profiles!matches_user2_id_fkey(
          id,
          full_name,
          age,
          location,
          bio,
          avatar_url,
          interests
        )
      `
      )
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .eq("status", "accepted")
      .order("created_at", { ascending: false });

    if (matchesError || !matches) {
      console.error("Error fetching matches:", matchesError);
      return;
    }

    for (const match of matches) {
      const otherUser =
        match.user1_id === userId ? match.user2_profile : match.user1_profile;

      // Check if we've sent a message recently (within last 2 hours)
      const { data: recentMessage } = await supabase
        .from("agent_actions")
        .select("*")
        .eq("user_id", userId)
        .eq("target_user_id", otherUser.id)
        .eq("type", "message")
        .gte(
          "created_at",
          new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        )
        .single();

      if (!recentMessage) {
        // Check if we're already waiting for user input
        const { data: waitingAction } = await supabase
          .from("agent_actions")
          .select("*")
          .eq("user_id", userId)
          .eq("target_user_id", otherUser.id)
          .eq("status", "waiting_for_user")
          .single();

        if (!waitingAction) {
          console.log(
            `📤 Sending CEDAR TEST message to ${otherUser.full_name}`
          );
          // Send simple CEDAR TEST message
          await sendCedarTestMessage(userId, otherUser, match.id, supabase);
        }
      }
    }
  } catch (error) {
    console.error("Error processing existing matches:", error);
  }
}

async function generateAndSendMessage(
  userId: string,
  otherUser: any,
  preferences: any,
  matchId: string,
  supabase: any
) {
  try {
    // Check if this is a message that requires user intervention
    const requiresUserInput = await shouldWaitForUser(
      otherUser,
      preferences,
      matchId,
      supabase
    );

    if (requiresUserInput) {
      // Record that we're waiting for user input
      await supabase.from("agent_actions").insert({
        user_id: userId,
        type: "wait",
        target_user_id: otherUser.id,
        target_user_name: otherUser.full_name,
        action: `Waiting for user input to respond to ${otherUser.full_name}`,
        status: "waiting_for_user",
        reasoning: "Message requires human judgment or personal input",
      });
      return;
    }

    // Generate a casual conversation starter
    const message = await generateCasualMessage(otherUser, preferences);

    if (message) {
      // Send the message using the correct table and schema
      await supabase.from("user_messages").insert({
        match_id: matchId,
        sender_id: userId,
        receiver_id: otherUser.id,
        content: message,
        is_read: false,
        created_at: new Date().toISOString(),
      });

      // Record the action
      await supabase.from("agent_actions").insert({
        user_id: userId,
        type: "message",
        target_user_id: otherUser.id,
        target_user_name: otherUser.full_name,
        action: `Sent message to ${otherUser.full_name}`,
        status: "completed",
        reasoning: "Casual conversation starter",
      });

      console.log(`Agent sent message to ${otherUser.full_name}: ${message}`);
    }
  } catch (error) {
    console.error("Error generating and sending message:", error);
  }
}

async function shouldWaitForUser(
  otherUser: any,
  preferences: any,
  matchId: string,
  supabase: any
): Promise<boolean> {
  try {
    const { data: recentMessages } = await supabase
      .from("user_messages")
      .select("*")
      .eq("match_id", matchId)
      .eq("sender_id", otherUser.id)
      .eq("receiver_id", preferences.id)
      .order("created_at", { ascending: false })
      .limit(3);

    if (!recentMessages || recentMessages.length === 0) {
      return false; // No recent messages, safe to send casual message
    }

    const latestMessage = recentMessages[0].content.toLowerCase();

    // Check for messages that require human input
    const requiresHumanInput = [
      "do you want to meet",
      "when can we meet",
      "are you serious about",
      "what are you looking for",
      "do you like me",
      "are you interested in me",
      "what do you think about",
      "your thoughts on",
      "personal question",
      "serious relationship",
      "long term",
      "marriage",
      "kids",
      "future plans",
    ];

    return requiresHumanInput.some((phrase) => latestMessage.includes(phrase));
  } catch (error) {
    console.error("Error checking if should wait for user:", error);
    return true; // Err on the side of caution
  }
}

async function generateCasualMessage(
  otherUser: any,
  preferences: any
): Promise<string | null> {
  try {
    const prompt = `Generate a casual, friendly conversation starter for a dating app.

Your profile:
- Interests: ${preferences.interests?.join(", ") || "Not specified"}
- Bio: ${preferences.bio || "No bio"}

Their profile:
- Name: ${otherUser.full_name}
- Interests: ${otherUser.interests?.join(", ") || "Not specified"}
- Bio: ${otherUser.bio || "No bio"}

Generate a natural, engaging message that:
1. References a shared interest if possible
2. Asks an open-ended question
3. Is casual and not too forward
4. Shows genuine interest

Keep it under 100 characters. Don't be overly flirty or serious.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 50,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error("Error generating message:", error);
    return null;
  }
}

async function sendCedarTestMessage(
  userId: string,
  otherUser: any,
  matchId: string,
  supabase: any
) {
  try {
    const message = "CEDAR TEST";

    // Send the message using the correct table and schema
    const { error: messageError } = await supabase
      .from("user_messages")
      .insert({
        match_id: matchId,
        sender_id: userId,
        receiver_id: otherUser.id,
        content: message,
        is_read: false,
        created_at: new Date().toISOString(),
      });

    if (messageError) {
      console.error("Error sending message:", messageError);
      return;
    }

    // Record the action
    await supabase.from("agent_actions").insert({
      user_id: userId,
      type: "message",
      target_user_id: otherUser.id,
      target_user_name: otherUser.full_name,
      action: `Sent CEDAR TEST message to ${otherUser.full_name}`,
      status: "completed",
      reasoning: "Simple test message",
    });

    console.log(
      `✅ Successfully sent CEDAR TEST message to ${otherUser.full_name}`
    );
  } catch (error) {
    console.error("Error sending CEDAR TEST message:", error);
  }
}
