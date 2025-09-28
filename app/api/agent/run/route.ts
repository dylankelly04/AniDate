import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    console.log(
      `🚀 [AGENT RUN] Agent run endpoint called at ${new Date().toISOString()}`
    );

    const { userId } = await request.json();

    if (!userId) {
      console.error("❌ [AGENT RUN] No user ID provided");
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    console.log(`👤 [AGENT RUN] Processing agent run for user: ${userId}`);

    // Use service role client for server-side operations
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if agent is active for this user in the database
    const { data: userProfile, error: profileError } = await supabase
      .from("profiles")
      .select("agent_active")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("❌ [AGENT RUN] Error checking agent state:", profileError);
      return NextResponse.json({
        success: false,
        message: "Error checking agent state",
      });
    }

    console.log(
      `🔍 [AGENT RUN] Agent state check:`,
      userProfile?.agent_active ? "Agent is active" : "Agent is inactive"
    );

    if (!userProfile?.agent_active) {
      console.log(`❌ [AGENT RUN] Agent is not active for user ${userId}`);
      return NextResponse.json({
        success: false,
        message: "Agent is not active",
      });
    }

    // Process existing matches to send messages
    console.log(`🔄 [AGENT RUN] Starting to process existing matches...`);
    await processExistingMatches(userId, supabase);
    console.log(`✅ [AGENT RUN] Finished processing existing matches`);

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
    console.log(
      `🔍 [AGENT RUN] Starting processExistingMatches for user: ${userId}`
    );

    // Get user preferences
    const { data: preferences } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!preferences) {
      console.error("❌ [AGENT RUN] No user preferences found");
      return;
    }

    console.log(`✅ [AGENT RUN] User preferences loaded:`, {
      interests: preferences.interests,
      bio: preferences.bio?.substring(0, 50) + "...",
    });

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
      console.error("❌ [AGENT RUN] Error fetching matches:", matchesError);
      return;
    }

    console.log(`📊 [AGENT RUN] Found ${matches.length} matches to process`);

    for (const match of matches) {
      console.log(
        `🔍 [AGENT RUN] Processing match ${match.id} with user: ${
          match.user1_id === userId
            ? match.user2_profile?.full_name
            : match.user1_profile?.full_name
        }`
      );
      const otherUser =
        match.user1_id === userId ? match.user2_profile : match.user1_profile;

      // Always send a message - no time restrictions
      console.log(
        `📤 [AGENT RUN] Always sending message to ${otherUser.full_name} (no time restrictions)`
      );

      // Check if we're already waiting for user input
      const { data: waitingAction } = await supabase
        .from("agent_actions")
        .select("*")
        .eq("user_id", userId)
        .eq("target_user_id", otherUser.id)
        .eq("status", "waiting_for_user")
        .single();

      console.log(
        `⏳ [AGENT RUN] Waiting action check for ${otherUser.full_name}:`,
        waitingAction ? "Found waiting action" : "No waiting action"
      );

      if (!waitingAction) {
        // Get the user's last AI message timestamp
        const { data: userProfile, error: profileError } = await supabase
          .from("profiles")
          .select("last_ai_message_timestamp")
          .eq("id", userId)
          .single();

        if (profileError) {
          console.error(
            `❌ [AGENT RUN] Error fetching user profile:`,
            profileError
          );
          continue;
        }

        const lastAiTimestamp = userProfile?.last_ai_message_timestamp;

        // Check if there are messages from the other person AFTER the last AI message
        let newMessagesQuery = supabase
          .from("user_messages")
          .select("*")
          .eq("match_id", match.id)
          .eq("sender_id", otherUser.id)
          .eq("receiver_id", userId)
          .order("created_at", { ascending: false })
          .limit(1);

        // Only look for messages after the last AI message timestamp
        if (lastAiTimestamp) {
          newMessagesQuery = newMessagesQuery.gt("created_at", lastAiTimestamp);
        }

        const { data: newMessages, error: newMessagesError } =
          await newMessagesQuery;

        if (newMessagesError) {
          console.error(
            `❌ [AGENT RUN] Error checking new messages for ${otherUser.full_name}:`,
            newMessagesError
          );
          continue;
        }

        // Check if chat is completely empty
        const { data: allMessages, error: allMessagesError } = await supabase
          .from("user_messages")
          .select("*")
          .eq("match_id", match.id)
          .limit(1);

        if (allMessagesError) {
          console.error(
            `❌ [AGENT RUN] Error checking all messages for ${otherUser.full_name}:`,
            allMessagesError
          );
          continue;
        }

        const hasNewMessages = newMessages && newMessages.length > 0;
        const isChatEmpty = !allMessages || allMessages.length === 0;

        console.log(`🔍 [AGENT RUN] Pre-check for ${otherUser.full_name}:`, {
          hasNewMessages,
          isChatEmpty,
          newMessageCount: newMessages?.length || 0,
          totalMessages: allMessages?.length || 0,
          lastAiTimestamp: lastAiTimestamp || "never",
          newestMessageTime: newMessages?.[0]?.created_at || "none",
        });

        if (hasNewMessages || isChatEmpty) {
          console.log(
            `📤 [AGENT RUN] Processing ${otherUser.full_name} - ${
              hasNewMessages ? "has new messages" : "chat is empty"
            }`
          );

          await readAndRespondToChat(
            userId,
            otherUser,
            match.id,
            preferences,
            supabase
          );
        } else {
          console.log(
            `⏭️ [AGENT RUN] Skipping ${otherUser.full_name} - no new messages and chat not empty`
          );
        }
      } else {
        console.log(
          `⏳ [AGENT RUN] Skipping ${otherUser.full_name} - waiting for user input`
        );
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

async function readAndRespondToChat(
  userId: string,
  otherUser: any,
  matchId: string,
  preferences: any,
  supabase: any
) {
  try {
    console.log(
      `🔍 [READ_CHAT] Starting readAndRespondToChat for match ${matchId} with ${otherUser.full_name}`
    );

    // Check if there are any unread messages from the other person
    const { data: unreadMessages, error: unreadError } = await supabase
      .from("user_messages")
      .select("*")
      .eq("match_id", matchId)
      .eq("sender_id", otherUser.id)
      .eq("receiver_id", userId)
      .eq("is_read", false)
      .order("created_at", { ascending: false })
      .limit(1);

    if (unreadError) {
      console.error(
        "❌ [READ_CHAT] Error fetching unread messages:",
        unreadError
      );
      return;
    }

    // Check if chat is completely empty
    const { data: allMessages, error: allMessagesError } = await supabase
      .from("user_messages")
      .select("*")
      .eq("match_id", matchId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (allMessagesError) {
      console.error(
        "❌ [READ_CHAT] Error fetching all messages:",
        allMessagesError
      );
      return;
    }

    console.log(`📨 [READ_CHAT] Message check:`, {
      unreadMessages: unreadMessages?.length || 0,
      allMessages: allMessages?.length || 0,
      unreadContent:
        unreadMessages?.[0]?.content?.substring(0, 50) + "..." || "none",
    });

    let shouldSendMessage = false;
    let responseMessage: string;

    if (unreadMessages && unreadMessages.length > 0) {
      // There's an unread message from the other person - respond to it
      shouldSendMessage = true;
      const theirMessage = unreadMessages[0].content;
      console.log(
        `💬 [READ_CHAT] Unread message from ${otherUser.full_name}: "${theirMessage}"`
      );

      console.log(`🤖 [READ_CHAT] Calling OpenAI to generate response...`);
      responseMessage = await generateContextualResponse(
        theirMessage,
        otherUser,
        preferences
      );
      console.log(
        `🤖 [READ_CHAT] OpenAI response generated: "${responseMessage}"`
      );
    } else if (!allMessages || allMessages.length === 0) {
      // Chat is completely empty - send greeting
      shouldSendMessage = true;
      responseMessage = "hi, nice to meet you!";
      console.log(
        `💬 [READ_CHAT] Chat is empty with ${otherUser.full_name}, sending greeting`
      );
    } else {
      // No unread messages and chat is not empty - don't send anything
      console.log(
        `⏭️ [READ_CHAT] No unread messages from ${otherUser.full_name}, skipping response`
      );
      return;
    }

    if (shouldSendMessage && responseMessage) {
      console.log(`📤 [READ_CHAT] Attempting to send message to database...`);

      // Send the response message
      const { error: messageError } = await supabase
        .from("user_messages")
        .insert({
          match_id: matchId,
          sender_id: userId,
          receiver_id: otherUser.id,
          content: responseMessage,
          is_read: false,
          created_at: new Date().toISOString(),
        });

      if (messageError) {
        console.error(
          "❌ [READ_CHAT] Error sending response message:",
          messageError
        );
        return;
      }

      console.log(
        `✅ [READ_CHAT] Message inserted into user_messages table successfully`
      );

      // Update the last AI message timestamp to prevent duplicate processing
      const currentTimestamp = new Date().toISOString();
      const { error: timestampError } = await supabase
        .from("profiles")
        .update({ last_ai_message_timestamp: currentTimestamp })
        .eq("id", userId);

      if (timestampError) {
        console.error(
          "❌ [READ_CHAT] Error updating AI message timestamp:",
          timestampError
        );
      } else {
        console.log(
          `✅ [READ_CHAT] Updated last AI message timestamp: ${currentTimestamp}`
        );
      }

      // Record the action
      const { error: actionError } = await supabase
        .from("agent_actions")
        .insert({
          user_id: userId,
          type: "message",
          target_user_id: otherUser.id,
          target_user_name: otherUser.full_name,
          action: `Sent response to ${otherUser.full_name}`,
          status: "completed",
          reasoning: "Contextual response based on their message",
        });

      if (actionError) {
        console.error(
          "❌ [READ_CHAT] Error recording agent action:",
          actionError
        );
      } else {
        console.log(`✅ [READ_CHAT] Agent action recorded successfully`);
      }

      console.log(
        `✅ [READ_CHAT] Successfully sent response to ${otherUser.full_name}: "${responseMessage}"`
      );
    } else {
      console.log(
        `❌ [READ_CHAT] No response message generated or not needed, skipping send`
      );
    }
  } catch (error) {
    console.error("Error reading and responding to chat:", error);
  }
}

async function generateContextualResponse(
  theirMessage: string,
  otherUser: any,
  preferences: any
): Promise<string> {
  try {
    console.log(`🤖 [OPENAI] Starting OpenAI API call...`);
    console.log(`🤖 [OPENAI] Input message: "${theirMessage}"`);
    console.log(`🤖 [OPENAI] Other user: ${otherUser.full_name}`);

    const customInstructions = preferences.agentic_dating_instructions || "";

    const prompt = `Generate a natural, engaging response to this message from a dating app match.

Their message: "${theirMessage}"

Your profile:
- Interests: ${preferences.interests?.join(", ") || "Not specified"}
- Bio: ${preferences.bio || "No bio"}

Their profile:
- Name: ${otherUser.full_name}
- Interests: ${otherUser.interests?.join(", ") || "Not specified"}
- Bio: ${otherUser.bio || "No bio"}

${
  customInstructions
    ? `CUSTOM DATING INSTRUCTIONS: ${customInstructions}

Follow these specific instructions when crafting your response:`
    : ""
}

Generate a response that:
1. Directly addresses what they said
2. Shows genuine interest and engagement
3. Asks a follow-up question or adds to the conversation
4. Is natural and conversational (not robotic)
5. Keeps it under 100 characters
6. Matches the tone of their message
${
  customInstructions
    ? "7. Follows the custom dating instructions provided above"
    : ""
}

Examples:
- If they ask "How's your day?" → "Great! Just finished [activity]. How about yours?"
- If they mention an interest → "That's awesome! I love [related topic]. What got you into it?"
- If they're being flirty → "Haha, you're smooth! 😊 Tell me more..."
- If they ask a question → Answer directly and ask back

Be authentic and engaging. Don't be overly formal or use dating app clichés.`;

    console.log(`🤖 [OPENAI] Sending request to OpenAI API...`);
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 80,
      temperature: 0.8,
    });

    const generatedResponse =
      response.choices[0]?.message?.content?.trim() ||
      "That's interesting! Tell me more.";
    console.log(`🤖 [OPENAI] API response received: "${generatedResponse}"`);

    return generatedResponse;
  } catch (error) {
    console.error("❌ [OPENAI] Error generating contextual response:", error);
    return "That's interesting! Tell me more.";
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
