export interface ConversationSuggestion {
  text: string;
  tone: "casual" | "flirty" | "deep" | "funny" | "supportive";
}

export interface SuggestionsResponse {
  success: boolean;
  suggestions?: ConversationSuggestion[];
  error?: string;
}

/**
 * Generate conversation suggestions using OpenAI
 */
export async function generateConversationSuggestions(
  context: "ai_character" | "real_person",
  characterName?: string,
  characterPersonality?: string,
  conversationHistory?: Array<{ role: string; content: string }>,
  userProfile?: {
    interests?: string[];
    personality?: string;
  }
): Promise<SuggestionsResponse> {
  try {
    console.log("Generating conversation suggestions:", {
      context,
      characterName,
      hasHistory: !!conversationHistory?.length,
      historyLength: conversationHistory?.length || 0,
    });

    const response = await fetch("/api/ai-assistant/suggestions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        context,
        characterName,
        characterPersonality,
        conversationHistory,
        userProfile,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("API error:", data);
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    if (!data.success) {
      console.error("AI Assistant error:", data.error);
      return {
        success: false,
        error: data.error,
      };
    }

    console.log(
      "Conversation suggestions received:",
      data.suggestions?.length || 0
    );

    return {
      success: true,
      suggestions: data.suggestions,
    };
  } catch (error) {
    console.error("Network error calling AI Assistant API:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Generate context-aware suggestions for AI characters
 */
export async function generateAICharacterSuggestions(
  characterName: string,
  characterPersonality: string,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<SuggestionsResponse> {
  return generateConversationSuggestions(
    "ai_character",
    characterName,
    characterPersonality,
    conversationHistory
  );
}

/**
 * Generate context-aware suggestions for real people
 */
export async function generateRealPersonSuggestions(
  conversationHistory: Array<{ role: string; content: string }>,
  userProfile?: {
    interests?: string[];
    personality?: string;
  }
): Promise<SuggestionsResponse> {
  return generateConversationSuggestions(
    "real_person",
    undefined,
    undefined,
    conversationHistory,
    userProfile
  );
}
