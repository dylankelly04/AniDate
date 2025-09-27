import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

// Check if API key is available
if (!process.env.OPENAI_KEY) {
  console.error("OPENAI_KEY environment variable is not set!");
}

export async function POST(request: NextRequest) {
  try {
    const { systemPrompt, conversationHistory, userMessage } =
      await request.json();

    if (!systemPrompt || !userMessage) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Prepare messages for OpenAI
    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
      ...conversationHistory,
      {
        role: "user",
        content: userMessage,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Using the more cost-effective model
      messages: messages as any,
      max_tokens: 300, // Limit response length for chat
      temperature: 0.8, // Add some creativity to responses
      presence_penalty: 0.1,
      frequency_penalty: 0.1,
    });

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      return NextResponse.json(
        { success: false, error: "No response generated from OpenAI" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: response.trim(),
    });
  } catch (error) {
    console.error("OpenAI API error:", error);

    // Handle different types of errors
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        return NextResponse.json(
          { success: false, error: "OpenAI API key not configured properly" },
          { status: 500 }
        );
      }
      if (error.message.includes("quota")) {
        return NextResponse.json(
          { success: false, error: "OpenAI API quota exceeded" },
          { status: 429 }
        );
      }
      if (error.message.includes("rate limit")) {
        return NextResponse.json(
          { success: false, error: "OpenAI API rate limit exceeded" },
          { status: 429 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown OpenAI error",
      },
      { status: 500 }
    );
  }
}
