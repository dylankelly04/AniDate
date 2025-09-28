import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { subtractAuraPoints, getUserAuraStats } from "@/lib/aura-service";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const {
      context,
      characterName,
      characterPersonality,
      conversationHistory,
      userProfile,
      userId,
    } = await request.json();

    if (!context) {
      return NextResponse.json(
        { success: false, error: "Missing context" },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "User ID is required" },
        { status: 400 }
      );
    }

    // Check if user has enough aura points (cost: 20 points)
    const AURA_COST = 20;
    const auraStats = await getUserAuraStats(userId);

    if (!auraStats.success) {
      return NextResponse.json(
        { success: false, error: "Failed to check aura points" },
        { status: 500 }
      );
    }

    if (auraStats.auraPoints < AURA_COST) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient aura points",
          required: AURA_COST,
          current: auraStats.auraPoints,
          short: AURA_COST - auraStats.auraPoints,
        },
        { status: 402 } // Payment Required
      );
    }

    let systemPrompt: string;
    let userPrompt: string;

    if (context === "ai_character") {
      // AI Character suggestions
      systemPrompt = `You are a dating coach AI assistant. Generate 3 conversation starter suggestions for someone chatting with an AI anime character. The suggestions should be engaging, appropriate, and help build connection. Each suggestion should have a different tone: casual, flirty, and deep/meaningful. Return ONLY a JSON array with this exact format:
[
  {"text": "suggestion 1", "tone": "casual"},
  {"text": "suggestion 2", "tone": "flirty"},
  {"text": "suggestion 3", "tone": "deep"}
]`;

      userPrompt = `Character: ${characterName}
Personality: ${characterPersonality}
Recent conversation: ${
        conversationHistory
          ?.slice(-3)
          .map((msg: any) => `${msg.role}: ${msg.content}`)
          .join("\n") || "No previous messages"
      }

Generate 3 conversation suggestions that would work well with this character's personality.`;
    } else {
      // Real person suggestions
      systemPrompt = `You are a dating coach AI assistant. Generate 3 conversation starter suggestions for someone chatting with a real person on a dating app. The suggestions should be engaging, appropriate, and help build genuine connection. Each suggestion should have a different tone: casual, flirty, and deep/meaningful. Return ONLY a JSON array with this exact format:
[
  {"text": "suggestion 1", "tone": "casual"},
  {"text": "suggestion 2", "tone": "flirty"},
  {"text": "suggestion 3", "tone": "deep"}
]`;

      const userInterests =
        userProfile?.interests?.join(", ") || "general interests";
      const recentMessages =
        conversationHistory
          ?.slice(-3)
          .map((msg: any) => `${msg.role}: ${msg.content}`)
          .join("\n") || "No previous messages";

      userPrompt = `User interests: ${userInterests}
Recent conversation: ${recentMessages}

Generate 3 conversation suggestions that would work well for building connection with a real person.`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      max_tokens: 400,
      temperature: 0.8,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      return NextResponse.json(
        { success: false, error: "No response generated from OpenAI" },
        { status: 500 }
      );
    }

    try {
      // Parse the JSON response
      const suggestions = JSON.parse(response.trim());

      // Validate the response format
      if (!Array.isArray(suggestions) || suggestions.length !== 3) {
        throw new Error("Invalid response format");
      }

      // Validate each suggestion
      for (const suggestion of suggestions) {
        if (!suggestion.text || !suggestion.tone) {
          throw new Error("Invalid suggestion format");
        }
        if (
          !["casual", "flirty", "deep", "funny", "supportive"].includes(
            suggestion.tone
          )
        ) {
          suggestion.tone = "casual"; // Default fallback
        }
      }

      // Consume aura points after successful generation
      console.log("🔄 Attempting to consume aura points...");
      const auraResult = await subtractAuraPoints(
        userId,
        AURA_COST,
        "Ani Suggestion"
      );

      console.log("📊 Aura result:", auraResult);

      if (!auraResult.success) {
        console.error("❌ Failed to consume aura points:", auraResult.error);
        return NextResponse.json(
          {
            success: false,
            error: "Failed to consume aura points: " + auraResult.error,
            suggestions: suggestions,
            auraCost: AURA_COST,
            auraResult: auraResult,
          },
          { status: 500 }
        );
      }

      console.log("✅ Successfully consumed aura points");

      return NextResponse.json({
        success: true,
        suggestions: suggestions,
        auraCost: AURA_COST,
        auraResult: auraResult,
      });
    } catch (parseError) {
      console.error("Failed to parse OpenAI response:", parseError);
      console.error("Raw response:", response);

      // Fallback suggestions if parsing fails
      const fallbackSuggestions = [
        {
          text: "That's really interesting! Tell me more about that.",
          tone: "casual",
        },
        {
          text: "You seem like someone I'd love to get to know better 😊",
          tone: "flirty",
        },
        { text: "What's something you're passionate about?", tone: "deep" },
      ];

      return NextResponse.json({
        success: true,
        suggestions: fallbackSuggestions,
      });
    }
  } catch (error) {
    console.error("AI Assistant API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
