import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get all matches in the database
    const { data: allMatches, error: allMatchesError } = await supabase
      .from("matches")
      .select("*")
      .order("created_at", { ascending: false });

    // Get all profiles
    const { data: allProfiles, error: allProfilesError } = await supabase
      .from("profiles")
      .select("id, full_name");

    // Check specifically for your user ID in matches
    const yourUserId = "62403fd7-5a46-4e5e-95c2-69e2ca5b65dc";
    const { data: yourMatches, error: yourMatchesError } = await supabase
      .from("matches")
      .select("*")
      .or(`user1_id.eq.${yourUserId},user2_id.eq.${yourUserId}`)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      success: true,
      data: {
        totalMatches: allMatches?.length || 0,
        totalProfiles: allProfiles?.length || 0,
        yourMatches: yourMatches?.length || 0,
        matches: allMatches || [],
        profiles: allProfiles || [],
        yourMatchesData: yourMatches || [],
        errors: {
          matches: allMatchesError,
          profiles: allProfilesError,
          yourMatches: yourMatchesError,
        },
      },
    });
  } catch (error) {
    console.error("Error in debug matches:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
