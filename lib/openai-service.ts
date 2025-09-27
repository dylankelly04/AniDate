export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Generate AI character response using OpenAI via API route
 */
export async function generateCharacterResponse(
  systemPrompt: string,
  conversationHistory: ChatMessage[],
  userMessage: string
): Promise<ChatResponse> {
  try {
    console.log("Sending to OpenAI API:", {
      systemPrompt: systemPrompt.substring(0, 100) + "...",
      messageCount: conversationHistory.length + 2,
      userMessage: userMessage.substring(0, 50) + "...",
    });

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemPrompt,
        conversationHistory,
        userMessage,
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
      console.error("OpenAI error:", data.error);
      return {
        success: false,
        error: data.error,
      };
    }

    console.log(
      "OpenAI response received:",
      data.message?.substring(0, 100) + "..."
    );

    return {
      success: true,
      message: data.message,
    };
  } catch (error) {
    console.error("Network error calling OpenAI API:", error);

    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Convert conversation messages to OpenAI format
 */
export function convertMessagesToOpenAIFormat(
  messages: Array<{ role: string; content: string }>
): ChatMessage[] {
  return messages
    .filter((msg) => msg.role === "user" || msg.role === "assistant")
    .map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));
}
