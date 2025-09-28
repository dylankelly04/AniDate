import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";
import { CedarDatingAgent } from "@/lib/cedar-dating-agent";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { userId, message, action } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Get user preferences
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (!userProfile) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    const agent = new CedarDatingAgent({
      userId,
      preferences: {
        interests: userProfile.interests || [],
        relationship_type: userProfile.relationship_type || "",
        age: userProfile.age,
        bio: userProfile.bio,
      },
    });

    // Handle different actions
    switch (action) {
      case "get_context":
        const context = await agent.getAgentContext();
        return NextResponse.json({ context });

      case "get_insights":
        const insights = await agent.getDatingInsights();
        return NextResponse.json({ insights });

      case "get_waiting_actions":
        const waitingActions = await agent.getWaitingActions();
        return NextResponse.json({ waitingActions });

      case "get_conversation_suggestions":
        const { matchId } = await request.json();
        const suggestions = await agent.getConversationSuggestions(matchId);
        return NextResponse.json({ suggestions });

      case "read_and_respond":
        const { matchId: respondMatchId } = await request.json();
        if (!respondMatchId) {
          return NextResponse.json(
            { error: "Match ID is required for read_and_respond action" },
            { status: 400 }
          );
        }
        const matchResponse = await agent.readAndRespondToMatch(respondMatchId);
        return NextResponse.json(matchResponse);

      case "chat":
        if (!message) {
          return NextResponse.json(
            { error: "Message is required for chat action" },
            { status: 400 }
          );
        }

        const agentContext = await agent.getAgentContext();
        const waitingActionsForChat = await agent.getWaitingActions();

        const prompt = `${agentContext}

User Message: ${message}

Waiting Actions: ${waitingActionsForChat.map((a) => `- ${a.action}`).join("\n")}

Please respond as the AI dating assistant. Be helpful, encouraging, and provide actionable advice. If there are waiting actions, mention them and offer to help with responses.`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 500,
          temperature: 0.7,
        });

        const aiResponse =
          response.choices[0]?.message?.content ||
          "I'm here to help with your dating journey!";

        return NextResponse.json({
          response: aiResponse,
          context: agentContext,
          waitingActions: waitingActionsForChat.length,
        });

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("Error in cedar agent endpoint:", error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
