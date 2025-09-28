import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { userId, preferences } = await request.json();

    console.log("🚀 Agent start request received:", {
      userId,
      hasPreferences: !!preferences,
    });

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

    // Test basic database access
    console.log("🔍 Testing basic database access with service role...");
    const { data: testData, error: testError } = await supabase
      .from("matches")
      .select("count")
      .limit(1);
    console.log("🔍 Basic access test:", { testData, testError });

    // Start the agent process
    await startAgentProcess(userId, preferences, supabase);

    return NextResponse.json({
      success: true,
      message: "Agent started successfully",
    });
  } catch (error) {
    console.error("Error starting agent:", error);
    return NextResponse.json(
      { error: "Failed to start agent" },
      { status: 500 }
    );
  }
}

async function startAgentProcess(
  userId: string,
  preferences: any,
  supabase: any
) {
  try {
    console.log(
      "🤖 Starting simplified agent - only sending messages to existing matches"
    );

    // Set agent as active in the database
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        agent_active: true,
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Error setting agent as active:", updateError);
      return NextResponse.json(
        { error: "Failed to activate agent" },
        { status: 500 }
      );
    }

    console.log("✅ Agent set as active in database");

    // Only process existing matches and send messages
    await processExistingMatches(userId, preferences, supabase);
  } catch (error) {
    console.error("Error in agent process:", error);
  }
}

async function processPotentialMatch(
  userId: string,
  potentialMatch: any,
  preferences: any,
  supabase: any
) {
  try {
    // Use AI to decide whether to swipe right
    const shouldSwipe = await shouldSwipeRight(potentialMatch, preferences);

    if (shouldSwipe) {
      // Record the swipe action
      await supabase.from("agent_actions").insert({
        user_id: userId,
        type: "swipe",
        target_user_id: potentialMatch.id,
        target_user_name: potentialMatch.full_name,
        action: `Swiped right on ${potentialMatch.full_name}`,
        status: "completed",
        reasoning: `Matched interests: ${getMatchingInterests(
          potentialMatch.interests,
          preferences.interests
        ).join(", ")}`,
      });

      // Create a match if the other user has also swiped right
      const { data: existingMatch } = await supabase
        .from("matches")
        .select("*")
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .or(`user1_id.eq.${potentialMatch.id},user2_id.eq.${potentialMatch.id}`)
        .single();

      if (!existingMatch) {
        // Check if the other user has swiped right on us
        const { data: otherUserSwipe } = await supabase
          .from("agent_actions")
          .select("*")
          .eq("user_id", potentialMatch.id)
          .eq("target_user_id", userId)
          .eq("type", "swipe")
          .single();

        if (otherUserSwipe) {
          // Create match
          await supabase.from("matches").insert({
            user1_id: userId,
            user2_id: potentialMatch.id,
            created_at: new Date().toISOString(),
          });
        }
      }
    } else {
      // Record a pass (swipe left)
      await supabase.from("agent_actions").insert({
        user_id: userId,
        type: "swipe",
        target_user_id: potentialMatch.id,
        target_user_name: potentialMatch.full_name,
        action: `Passed on ${potentialMatch.full_name}`,
        status: "completed",
        reasoning: "No matching interests or incompatible preferences",
      });
    }
  } catch (error) {
    console.error("Error processing potential match:", error);
  }
}

async function processExistingMatches(
  userId: string,
  preferences: any,
  supabase: any
) {
  try {
    console.log("🔍 Looking for existing matches...");
    console.log("🔍 User ID:", userId);

    // First, let's check what matches exist in the database
    const { data: allMatches, error: allMatchesError } = await supabase
      .from("matches")
      .select("*");

    console.log("🔍 All matches in database:", allMatches?.length || 0);
    if (allMatches && allMatches.length > 0) {
      console.log("🔍 Sample match:", allMatches[0]);
      console.log(
        "🔍 All match statuses:",
        allMatches.map((m: any) => ({
          id: m.id,
          user1_id: m.user1_id,
          user2_id: m.user2_id,
          status: m.status,
        }))
      );
    } else {
      console.log("🔍 NO MATCHES FOUND IN DATABASE AT ALL!");
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

    console.log("🔍 Using EXACT matches page query - result:", {
      matches: matches?.length || 0,
      error: matchesError,
    });

    console.log("🔍 Query result:", {
      matches: matches?.length || 0,
      error: matchesError,
    });

    if (matchesError) {
      console.error("Error fetching matches:", matchesError);
      return;
    }

    console.log(`📊 Found ${matches?.length || 0} matches for user ${userId}`);
    if (matches && matches.length > 0) {
      console.log("📊 Sample match for user:", matches[0]);
    }

    for (const match of matches) {
      const otherUser =
        match.user1_id === userId ? match.user2_profile : match.user1_profile;
      console.log(`💬 Processing match with ${otherUser.full_name}`);

      // Always send a message - no time restrictions
      console.log(
        `📤 Sending contextual message to ${otherUser.full_name} (no time restrictions)`
      );
      // Send contextual message using OpenAI
      await readAndRespondToChat(
        userId,
        otherUser,
        match.id,
        preferences,
        supabase
      );
    }
  } catch (error) {
    console.error("Error processing existing matches:", error);
  }
}

async function shouldSwipeRight(
  potentialMatch: any,
  preferences: any
): Promise<boolean> {
  try {
    const matchingInterests = getMatchingInterests(
      potentialMatch.interests,
      preferences.interests
    );

    if (matchingInterests.length === 0) {
      return false;
    }

    // Check if OpenAI key is available
    const apiKey =
      process.env.OPENAI_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!apiKey || apiKey.length < 20) {
      console.log("OpenAI key not available, using fallback logic");
      return matchingInterests.length > 0;
    }

    // Use AI to make a more nuanced decision
    const prompt = `You are a dating assistant helping someone decide whether to swipe right on a potential match.

User's preferences:
- Interests: ${preferences.interests?.join(", ") || "Not specified"}
- Relationship type: ${preferences.relationship_type || "Not specified"}
- Age: ${preferences.age || "Not specified"}

Potential match:
- Name: ${potentialMatch.full_name}
- Age: ${potentialMatch.age || "Not specified"}
- Interests: ${potentialMatch.interests?.join(", ") || "Not specified"}
- Bio: ${potentialMatch.bio || "No bio"}
- Relationship type: ${potentialMatch.relationship_type || "Not specified"}

Matching interests: ${matchingInterests.join(", ")}

Should the user swipe right? Consider compatibility, shared interests, and overall potential for a good match.

Respond with only "YES" or "NO" followed by a brief reason.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 100,
      temperature: 0.3,
    });

    const decision = response.choices[0]?.message?.content?.toUpperCase();
    return decision?.startsWith("YES") || false;
  } catch (error) {
    console.error("Error in AI swipe decision:", error);
    // Fallback to simple interest matching
    return (
      getMatchingInterests(potentialMatch.interests, preferences.interests)
        .length > 0
    );
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

      console.log(
        `Successfully sent message to ${otherUser.full_name}: ${message}`
      );
    }
  } catch (error) {
    console.error("Error generating and sending message:", error);
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
    // Get the most recent message from the other person
    const { data: recentMessages, error: messagesError } = await supabase
      .from("user_messages")
      .select("*")
      .eq("match_id", matchId)
      .eq("sender_id", otherUser.id)
      .eq("receiver_id", userId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (messagesError) {
      console.error("Error fetching recent messages:", messagesError);
      return;
    }

    let responseMessage: string;

    if (!recentMessages || recentMessages.length === 0) {
      // Chat is empty, send greeting
      responseMessage = "hi, nice to meet you!";
      console.log(
        `💬 Chat is empty with ${otherUser.full_name}, sending greeting`
      );
    } else {
      // Generate appropriate response based on their message
      const theirMessage = recentMessages[0].content;
      console.log(
        `💬 Last message from ${otherUser.full_name}: "${theirMessage}"`
      );

      responseMessage = await generateContextualResponse(
        theirMessage,
        otherUser,
        preferences
      );
    }

    if (responseMessage) {
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
        console.error("Error sending response message:", messageError);
        return;
      }

      // Record the action
      await supabase.from("agent_actions").insert({
        user_id: userId,
        type: "message",
        target_user_id: otherUser.id,
        target_user_name: otherUser.full_name,
        action: `Sent response to ${otherUser.full_name}`,
        status: "completed",
        reasoning: "Contextual response based on their message",
      });

      console.log(
        `✅ Successfully sent response to ${otherUser.full_name}: "${responseMessage}"`
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
    const prompt = `Generate a natural, engaging response to this message from a dating app match.

Their message: "${theirMessage}"

Your profile:
- Interests: ${preferences.interests?.join(", ") || "Not specified"}
- Bio: ${preferences.bio || "No bio"}

Their profile:
- Name: ${otherUser.full_name}
- Interests: ${otherUser.interests?.join(", ") || "Not specified"}
- Bio: ${otherUser.bio || "No bio"}

Generate a response that:
1. Directly addresses what they said
2. Shows genuine interest and engagement
3. Asks a follow-up question or adds to the conversation
4. Is natural and conversational (not robotic)
5. Keeps it under 100 characters
6. Matches the tone of their message

Examples:
- If they ask "How's your day?" → "Great! Just finished [activity]. How about yours?"
- If they mention an interest → "That's awesome! I love [related topic]. What got you into it?"
- If they're being flirty → "Haha, you're smooth! 😊 Tell me more..."
- If they ask a question → Answer directly and ask back

Be authentic and engaging. Don't be overly formal or use dating app clichés.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 80,
      temperature: 0.8,
    });

    return (
      response.choices[0]?.message?.content?.trim() ||
      "That's interesting! Tell me more."
    );
  } catch (error) {
    console.error("Error generating contextual response:", error);
    return "That's interesting! Tell me more.";
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
    // Check if OpenAI key is available
    const apiKey =
      process.env.OPENAI_KEY || process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    if (!apiKey || apiKey.length < 20) {
      console.log("OpenAI key not available, using fallback message");
      return generateFallbackMessage(otherUser, preferences);
    }

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
    return generateFallbackMessage(otherUser, preferences);
  }
}

function generateFallbackMessage(otherUser: any, preferences: any): string {
  const matchingInterests = getMatchingInterests(
    otherUser.interests || [],
    preferences.interests || []
  );

  const fallbackMessages = [
    `Hey ${otherUser.full_name}! How's your day going?`,
    `Hi ${otherUser.full_name}! What's something fun you've been up to lately?`,
    `Hey! I noticed we both like ${
      matchingInterests[0] || "similar things"
    }. What's your favorite part about it?`,
    `Hi ${otherUser.full_name}! What's the best thing that happened to you this week?`,
    `Hey! I'd love to get to know you better. What's something you're passionate about?`,
  ];

  // Return a message based on shared interests if available
  if (matchingInterests.length > 0) {
    return `Hey ${otherUser.full_name}! I see we both like ${matchingInterests[0]}. What's your favorite thing about it?`;
  }

  // Return a random fallback message
  return fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
}

async function runContinuousAgent(userId: string, supabase: any) {
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

    console.log("🔍 runContinuousAgent - User ID:", userId);

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

    console.log("🔍 runContinuousAgent query result:", {
      matches: matches?.length || 0,
      error: matchesError,
      userId: userId,
    });

    if (matchesError || !matches) {
      console.error("Error fetching matches:", matchesError);
      return;
    }

    console.log(`Found ${matches.length} matches to process`);

    if (matches.length === 0) {
      console.log(
        "No matches found. Checking if user has any matches at all..."
      );
      // Check if user has any matches regardless of status
      const { data: allMatches } = await supabase
        .from("matches")
        .select("*")
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`);
      console.log(
        `User has ${allMatches?.length || 0} total matches (any status)`
      );
      return;
    }

    for (const match of matches) {
      const otherUser =
        match.user1_id === userId ? match.user2_profile : match.user1_profile;

      // Always send a message - no time restrictions
      console.log(
        `📤 Sending contextual message to ${otherUser.full_name} (no time restrictions)`
      );
      // Send contextual message using OpenAI
      await readAndRespondToChat(
        userId,
        otherUser,
        match.id,
        preferences,
        supabase
      );
    }
  } catch (error) {
    console.error("Error in continuous agent:", error);
  }
}

function getMatchingInterests(
  userInterests: string[],
  myInterests: string[]
): string[] {
  if (!userInterests || !myInterests) return [];
  return userInterests.filter((interest) => myInterests.includes(interest));
}
