import { createClient } from "@/lib/supabase/client";

export interface AIMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface AIConversation {
  id: string;
  user_id: string;
  character_id: string;
  character_name: string;
  character_series: string;
  messages: AIMessage[];
  connection_level: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get or create a conversation for a user and character
 */
export async function getOrCreateConversation(
  userId: string,
  characterId: string,
  characterName: string,
  characterSeries: string
): Promise<{ success: boolean; conversationId?: string; error?: string }> {
  const supabase = createClient();

  try {
    // First, try to find an existing conversation
    const { data: existingConv, error: fetchError } = await supabase
      .from("ai_conversations")
      .select("id")
      .eq("user_id", userId)
      .eq("character_id", characterId)
      .single();

    if (existingConv) {
      console.log("Found existing conversation:", existingConv.id);
      return { success: true, conversationId: existingConv.id };
    }

    // If no conversation exists (PGRST116 = no rows found), create a new one
    if (fetchError && fetchError.code === "PGRST116") {
      console.log("No existing conversation found, creating new one");
      const { data: newConv, error: insertError } = await supabase
        .from("ai_conversations")
        .insert({
          user_id: userId,
          character_id: characterId,
          character_name: characterName,
          character_series: characterSeries,
          messages: [], // Start with empty messages array
        })
        .select("id")
        .single();

      if (insertError) {
        // If we get a duplicate key error, it means the conversation was created between our check and insert
        if (insertError.code === "23505") {
          console.log(
            "Conversation already exists (race condition), fetching it"
          );
          // Try to fetch the existing conversation again
          const { data: existingConv2, error: fetchError2 } = await supabase
            .from("ai_conversations")
            .select("id")
            .eq("user_id", userId)
            .eq("character_id", characterId)
            .single();

          if (existingConv2) {
            return { success: true, conversationId: existingConv2.id };
          }
        }
        console.error("Error creating conversation:", insertError);
        return { success: false, error: insertError.message };
      }

      console.log("Created new conversation:", newConv.id);
      return { success: true, conversationId: newConv.id };
    }

    // If there was a different error fetching, log it but don't fail
    console.warn("Unexpected error fetching conversation:", fetchError);

    // Try to create anyway, in case it's a temporary issue
    console.log("Attempting to create conversation despite fetch error");
    const { data: newConv, error: insertError } = await supabase
      .from("ai_conversations")
      .insert({
        user_id: userId,
        character_id: characterId,
        character_name: characterName,
        character_series: characterSeries,
        messages: [],
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        console.log("Conversation already exists, fetching it");
        const { data: existingConv2, error: fetchError2 } = await supabase
          .from("ai_conversations")
          .select("id")
          .eq("user_id", userId)
          .eq("character_id", characterId)
          .single();

        if (existingConv2) {
          return { success: true, conversationId: existingConv2.id };
        }
      }
      console.error("Error creating conversation:", insertError);
      return { success: false, error: insertError.message };
    }

    console.log("Created new conversation:", newConv.id);
    return { success: true, conversationId: newConv.id };
  } catch (error) {
    console.error("Error in getOrCreateConversation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Add a message to a conversation
 */
export async function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  try {
    // Get current conversation
    const { data: conversation, error: fetchError } = await supabase
      .from("ai_conversations")
      .select("messages")
      .eq("id", conversationId)
      .single();

    if (fetchError) {
      console.error("Error fetching conversation:", fetchError);
      return { success: false, error: fetchError.message };
    }

    // Add new message to the messages array
    const newMessage: AIMessage = {
      role,
      content,
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...(conversation.messages || []), newMessage];

    // Calculate connection level based on message count
    const connectionLevel =
      updatedMessages.length < 5
        ? 0
        : updatedMessages.length < 10
        ? 1
        : updatedMessages.length < 20
        ? 2
        : updatedMessages.length < 40
        ? 3
        : updatedMessages.length < 80
        ? 4
        : 5;

    // Update the conversation with the new message and connection level
    const { error: updateError } = await supabase
      .from("ai_conversations")
      .update({
        messages: updatedMessages,
        updated_at: new Date().toISOString(),
        connection_level: connectionLevel,
      })
      .eq("id", conversationId);

    if (updateError) {
      console.error("Error updating conversation:", updateError);
      return { success: false, error: updateError.message };
    }

    console.log("Message added successfully to conversation:", conversationId);
    return { success: true };
  } catch (error) {
    console.error("Error in addMessage:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get a conversation with all its messages
 */
export async function getConversationWithMessages(
  conversationId: string
): Promise<{
  success: boolean;
  conversation?: AIConversation;
  error?: string;
}> {
  const supabase = createClient();

  try {
    const { data: conversation, error } = await supabase
      .from("ai_conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (error) {
      console.error("Error fetching conversation:", error);
      return { success: false, error: error.message };
    }

    return { success: true, conversation };
  } catch (error) {
    console.error("Error in getConversationWithMessages:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get all conversations for a user
 */
export async function getUserConversations(userId: string): Promise<{
  success: boolean;
  conversations?: AIConversation[];
  error?: string;
}> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from("ai_conversations")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Error fetching user conversations:", error);
      return { success: false, error: error.message };
    }

    return { success: true, conversations: data || [] };
  } catch (error) {
    console.error("Error in getUserConversations:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get a conversation for a specific character for the current user
 */
export async function getConversationForCharacter(
  userId: string,
  characterId: string
): Promise<{
  success: boolean;
  conversation?: AIConversation;
  error?: string;
}> {
  const supabase = createClient();

  try {
    const { data: conversation, error } = await supabase
      .from("ai_conversations")
      .select("*")
      .eq("user_id", userId)
      .eq("character_id", characterId)
      .single();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching conversation:", error);
      return { success: false, error: error.message };
    }

    if (!conversation) {
      return { success: true, conversation: undefined }; // No conversation found, not an error
    }

    return { success: true, conversation };
  } catch (error) {
    console.error("Error in getConversationForCharacter:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
