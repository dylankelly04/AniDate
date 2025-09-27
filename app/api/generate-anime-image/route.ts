import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();
    console.log("Received request to generate anime image for:", imageUrl);

    if (!imageUrl) {
      console.error("No image URL provided");
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_KEY) {
      console.error("OpenAI API key not configured");
      return NextResponse.json(
        { error: "OpenAI API key not configured" },
        { status: 500 }
      );
    }

    console.log("Calling OpenAI API...");

    // First, use GPT-4o to analyze the uploaded image and describe the person
    const visionResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe the visual characteristics of this image for artistic purposes. Focus on observable features like hair color, eye color, clothing style, and general visual elements that would be useful for creating a stylized artistic representation.",
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      max_tokens: 300,
    });

    const personDescription = visionResponse.choices[0]?.message?.content;
    console.log("Person description:", personDescription);

    let animePrompt;

    if (
      !personDescription ||
      personDescription.includes("I'm sorry") ||
      personDescription.includes("can't help")
    ) {
      console.log("GPT-4o refused to analyze image, using fallback prompt");
      // Fallback to a generic anime character prompt
      animePrompt =
        "Create a beautiful anime character portrait, modern anime/manga style with clean lines, vibrant colors, and appealing character design. Professional anime character art, high quality, detailed facial features, attractive and charming appearance.";
    } else {
      // Use the description to generate an accurate anime version
      animePrompt = `Create an anime character portrait based on this description: "${personDescription}". Transform this person into a beautiful anime character while maintaining their key characteristics. Use modern anime/manga art style with clean lines, vibrant colors, and professional character design. Make it look like a high-quality anime character portrait that represents the same person.`;
    }

    console.log("Generating anime image with prompt:", animePrompt);

    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: animePrompt,
      size: "1024x1024",
      quality: "standard",
      n: 1,
    });

    console.log("OpenAI response:", response);

    const animeImageUrl = response.data[0]?.url;

    if (!animeImageUrl) {
      console.error("No anime image URL in response:", response);
      return NextResponse.json(
        { error: "Failed to generate anime image" },
        { status: 500 }
      );
    }

    console.log("Successfully generated anime image:", animeImageUrl);

    // Download the image server-side and return as base64
    try {
      const imageResponse = await fetch(animeImageUrl);
      if (!imageResponse.ok) {
        throw new Error(
          `Failed to download generated image: ${imageResponse.status}`
        );
      }

      const imageBuffer = await imageResponse.arrayBuffer();
      const base64Image = Buffer.from(imageBuffer).toString("base64");
      const mimeType = imageResponse.headers.get("content-type") || "image/png";

      return NextResponse.json({
        animeImageData: `data:${mimeType};base64,${base64Image}`,
        originalUrl: animeImageUrl,
      });
    } catch (downloadError) {
      console.error("Failed to download generated image:", downloadError);
      // Fallback to returning the URL
      return NextResponse.json({ animeImageUrl });
    }
  } catch (error) {
    console.error("Error generating anime image:", error);

    if (error instanceof Error) {
      console.error("Error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
