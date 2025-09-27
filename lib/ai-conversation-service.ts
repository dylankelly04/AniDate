// AI Conversation Service
// Handles storing and retrieving AI chat conversations and messages

import { createClient } from "@/lib/supabase/client";

export interface AIMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface AIConversation {
  id: string;
  user_id: string;
  character_id: string;
  character_name: string;
  character_series: string;
  created_at: string;
  updated_at: string;
  messages?: AIMessage[];
}

export interface ConversationWithMessages extends AIConversation {
  messages: AIMessage[];
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

    // If no conversation exists, create a new one
    if (fetchError && fetchError.code === "PGRST116") {
      console.log("No existing conversation found, creating new one");
      const { data: newConv, error: insertError } = await supabase
        .from("ai_conversations")
        .insert({
          user_id: userId,
          character_id: characterId,
          character_name: characterName,
          character_series: characterSeries,
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Error creating conversation:", insertError);
        return { success: false, error: insertError.message };
      }

      console.log("Created new conversation:", newConv.id);
      return { success: true, conversationId: newConv.id };
    }

    // If there was a different error
    console.error("Error fetching conversation:", fetchError);
    return { success: false, error: fetchError.message };
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
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const supabase = createClient();

  try {
    // Insert message directly into ai_messages table
    const { data, error } = await supabase
      .from("ai_messages")
      .insert({
        conversation_id: conversationId,
        role: role,
        content: content,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error adding message:", error);
      return { success: false, error: error.message };
    }

    // Update the conversation's updated_at timestamp
    await supabase
      .from("ai_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    console.log("Message added successfully:", data.id);
    return { success: true, messageId: data.id };
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
  conversation?: ConversationWithMessages;
  error?: string;
}> {
  const supabase = createClient();

  try {
    // Get conversation
    const { data: conversation, error: convError } = await supabase
      .from("ai_conversations")
      .select("*")
      .eq("id", conversationId)
      .single();

    if (convError) {
      console.error("Error fetching conversation:", convError);
      return { success: false, error: convError.message };
    }

    // Get messages
    const { data: messages, error: msgError } = await supabase
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (msgError) {
      console.error("Error fetching messages:", msgError);
      return { success: false, error: msgError.message };
    }

    return {
      success: true,
      conversation: {
        ...conversation,
        messages: messages || [],
      },
    };
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
 * Get conversation for a specific character
 */
export async function getConversationForCharacter(
  userId: string,
  characterId: string
): Promise<{
  success: boolean;
  conversation?: ConversationWithMessages;
  error?: string;
}> {
  const supabase = createClient();

  try {
    // Get conversation
    const { data: conversation, error: convError } = await supabase
      .from("ai_conversations")
      .select("*")
      .eq("user_id", userId)
      .eq("character_id", characterId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (convError) {
      // No conversation exists yet
      if (convError.code === "PGRST116") {
        return { success: true, conversation: undefined };
      }
      console.error("Error fetching conversation:", convError);
      return { success: false, error: convError.message };
    }

    // Get messages
    const { data: messages, error: msgError } = await supabase
      .from("ai_messages")
      .select("*")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: true });

    if (msgError) {
      console.error("Error fetching messages:", msgError);
      return { success: false, error: msgError.message };
    }

    return {
      success: true,
      conversation: {
        ...conversation,
        messages: messages || [],
      },
    };
  } catch (error) {
    console.error("Error in getConversationForCharacter:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
