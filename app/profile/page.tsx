"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { soundManager } from "@/lib/sounds";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { XPBar, LevelDisplay } from "@/components/ui/xp-bar";
import {
  Heart,
  User,
  Settings,
  ArrowLeft,
  Edit3,
  Save,
  X,
  MapPin,
  Calendar,
  Mail,
  Eye,
  EyeOff,
  Camera,
  Star,
  Users,
  MessageCircle,
  Sparkles,
  Trophy,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useClientOnly } from "@/hooks/use-client-only";
import { getLevelTitle, getLevelDescription } from "@/lib/aura-utils";

const INTERESTS = [
  "Anime",
  "Gaming",
  "Music",
  "Art",
  "Photography",
  "Travel",
  "Cooking",
  "Sports",
  "Reading",
  "Movies",
  "Nature",
  "Technology",
  "Fashion",
  "Fitness",
  "Dancing",
  "Writing",
];

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non-binary", label: "Non-binary" },
  { value: "other", label: "Other" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

const LOOKING_FOR_OPTIONS = [
  { value: "male", label: "Men" },
  { value: "female", label: "Women" },
  { value: "both", label: "Both" },
  { value: "everyone", label: "Everyone" },
];

interface ProfileData {
  id: string;
  full_name: string;
  age: number;
  location: string;
  bio: string;
  gender: string;
  looking_for: string;
  interests: string[];
  avatar_url: string | null;
  original_avatar_url: string | null;
  anime_avatar_url: string | null;
  created_at: string;
  updated_at: string;
  college: string | null;
  aura_points: number;
  level: number;
  total_aura_earned: number;
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { setTheme } = useTheme();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const mounted = useClientOnly();

  // Form state
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");
  const [lookingFor, setLookingFor] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [generatingAnime, setGeneratingAnime] = useState(false);
  const [showOriginalImage, setShowOriginalImage] = useState(false);

  // Preferences state
  const [preferences, setPreferences] = useState({
    // Dating preferences
    ageRangeMin: 18,
    ageRangeMax: 30,
    maxDistance: 25,
    relationshipType: "any",
    interestedIn: [] as string[],

    // Notification preferences
    newMatches: true,
    messages: true,
    profileViews: false,
    aiPracticeReminders: true,
    weeklySummary: false,

    // AI Practice preferences
    characterTypes: [] as string[],
    conversationDifficulty: "intermediate",

    // App preferences
    theme: "system",
    soundEffects: true,
  });

  const supabase = createClient();

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchPreferences();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (error) {
        setError("Profile not found. Please complete your profile setup.");
        return;
      }

      setProfile(data);

      // Populate form fields
      setFullName(data.full_name || "");
      setAge(data.age?.toString() || "");
      setLocation(data.location || "");
      setBio(data.bio || "");
      setGender(data.gender || "");
      setLookingFor(data.looking_for || "");
      setInterests(data.interests || []);
    } catch (err) {
      setError("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const fetchPreferences = async () => {
    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("preference_key, preference_value")
        .eq("user_id", user?.id);

      if (error) {
        console.error("Error fetching preferences:", error);
        return;
      }

      // Convert preferences array to object
      const prefs: any = {};
      data?.forEach((pref) => {
        const key = pref.preference_key;
        let value = pref.preference_value;

        // Parse JSON values
        if (value && (value.startsWith("[") || value.startsWith("{"))) {
          try {
            value = JSON.parse(value);
          } catch (e) {
            // Keep as string if parsing fails
          }
        }

        // Convert string booleans to actual booleans
        if (value === "true") value = true;
        if (value === "false") value = false;

        // Convert string numbers to actual numbers
        if (typeof value === "string" && !isNaN(Number(value))) {
          value = Number(value);
        }

        prefs[key] = value;
      });

      setPreferences((prev) => ({ ...prev, ...prefs }));

      // Apply theme if it exists in preferences
      if (prefs.theme) {
        setTheme(prefs.theme);
      }

      // Apply sound effects setting
      if (typeof prefs.soundEffects === "boolean") {
        soundManager.setEnabled(prefs.soundEffects);
      }
    } catch (err) {
      console.error("Exception in fetchPreferences:", err);
    }
  };

  const savePreferences = async () => {
    try {
      const preferencesArray = Object.entries(preferences).map(
        ([key, value]) => ({
          user_id: user?.id,
          preference_key: key,
          preference_value:
            typeof value === "object" ? JSON.stringify(value) : String(value),
        })
      );

      // Delete existing preferences first
      await supabase.from("user_preferences").delete().eq("user_id", user?.id);

      // Insert new preferences
      const { error } = await supabase
        .from("user_preferences")
        .insert(preferencesArray);

      if (error) {
        console.error("Error saving preferences:", error);
        setError("Failed to save preferences");
        return;
      }

      console.log("Preferences saved successfully");
    } catch (err) {
      console.error("Exception in savePreferences:", err);
      setError("Failed to save preferences");
    }
  };

  // Auto-save preferences when they change
  useEffect(() => {
    if (user && preferences) {
      const timeoutId = setTimeout(() => {
        savePreferences();
      }, 1000); // Auto-save after 1 second of no changes

      return () => clearTimeout(timeoutId);
    }
  }, [preferences, user]);

  const handleSave = async () => {
    if (!user || !profile) return;

    setSaving(true);
    setError("");

    // Validate required fields
    if (!fullName.trim()) {
      setError("Full name is required");
      setSaving(false);
      return;
    }

    if (
      age &&
      (isNaN(parseInt(age)) || parseInt(age) < 18 || parseInt(age) > 100)
    ) {
      setError("Age must be between 18 and 100");
      setSaving(false);
      return;
    }

    try {
      const updateData = {
        full_name: fullName.trim(),
        age: age ? parseInt(age) : null,
        location: location.trim(),
        bio: bio.trim(),
        gender: gender || null,
        looking_for: lookingFor || null,
        interests: interests,
      };

      console.log("Updating profile with data:", updateData);

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);

      if (error) {
        console.error("Error updating profile:", error);
        setError(`Failed to update profile: ${error.message}`);
        return;
      }

      // Save preferences
      await savePreferences();

      // Refresh profile data
      await fetchProfile();
      setEditing(false);
    } catch (err) {
      console.error("Error:", err);
      setError("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      // Reset form to original values
      setFullName(profile.full_name || "");
      setAge(profile.age?.toString() || "");
      setLocation(profile.location || "");
      setBio(profile.bio || "");
      setGender(profile.gender || "");
      setLookingFor(profile.looking_for || "");
      setInterests(profile.interests || []);
    }
    setEditing(false);
    setError("");
  };

  const handleInterestToggle = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const uploadBase64Image = async (
    base64Data: string,
    fileName: string
  ): Promise<string> => {
    try {
      console.log("Uploading base64 image to Supabase storage...");

      // Convert base64 to blob
      const response = await fetch(base64Data);
      const blob = await response.blob();
      const file = new File([blob], fileName, { type: blob.type });

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("user-avatars")
        .upload(`anime/${fileName}`, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Base64 image upload error:", uploadError);
        throw new Error(`Failed to upload anime image: ${uploadError.message}`);
      }

      console.log("Successfully uploaded base64 anime image");

      // Get the public URL
      const {
        data: { publicUrl },
      } = supabase.storage
        .from("user-avatars")
        .getPublicUrl(`anime/${fileName}`);

      console.log("Anime image public URL:", publicUrl);
      return publicUrl;
    } catch (error) {
      console.error("Error uploading base64 image:", error);
      throw error;
    }
  };

  const downloadAndUploadImage = async (
    imageUrl: string,
    fileName: string
  ): Promise<string | null> => {
    try {
      console.log("Downloading anime image from:", imageUrl);

      // Download the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error(
          "Failed to download image:",
          response.status,
          response.statusText
        );
        throw new Error(
          `Failed to download image: ${response.status} ${response.statusText}`
        );
      }

      const blob = await response.blob();
      console.log("Downloaded blob size:", blob.size, "type:", blob.type);

      const file = new File([blob], fileName, { type: blob.type });

      console.log("Uploading to Supabase storage...");

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("user-avatars")
        .upload(`anime/${fileName}`, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Anime image upload error:", uploadError);
        console.error("Upload error details:", {
          message: uploadError.message,
          statusCode: uploadError.statusCode,
          error: uploadError.error,
        });
        throw new Error(`Failed to upload anime image: ${uploadError.message}`);
      }

      console.log("Successfully uploaded anime image");

      // Get the public URL
      const {
        data: { publicUrl },
      } = supabase.storage
        .from("user-avatars")
        .getPublicUrl(`anime/${fileName}`);

      console.log("Anime image public URL:", publicUrl);
      return publicUrl;
    } catch (error) {
      console.error("Error downloading and uploading anime image:", error);
      throw error; // Re-throw to be caught by the calling function
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError("Image size must be less than 5MB");
      return;
    }

    setUploading(true);
    setError("");

    try {
      // Create a unique filename for original
      const fileExt = file.name.split(".").pop();
      const timestamp = Date.now();
      const originalFileName = `${user.id}-original-${timestamp}.${fileExt}`;
      const originalFilePath = `avatars/${originalFileName}`;

      // Upload original image to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("user-avatars")
        .upload(originalFilePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        console.error("Error details:", {
          message: uploadError.message,
          statusCode: uploadError.statusCode,
          error: uploadError.error,
        });
        setError(`Failed to upload image: ${uploadError.message}`);
        return;
      }

      // Get the public URL for original
      const {
        data: { publicUrl: originalUrl },
      } = supabase.storage.from("user-avatars").getPublicUrl(originalFilePath);

      // Generate anime version
      setGeneratingAnime(true);

      const animeResponse = await fetch("/api/generate-anime-image", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ imageUrl: originalUrl }),
      });

      if (!animeResponse.ok) {
        const errorData = await animeResponse.json().catch(() => ({}));
        console.error("Anime generation failed:", {
          status: animeResponse.status,
          statusText: animeResponse.statusText,
          error: errorData,
        });
        throw new Error(
          `Failed to generate anime version: ${
            errorData.error || animeResponse.statusText
          }`
        );
      }

      const responseData = await animeResponse.json();
      const { animeImageData, animeImageUrl } = responseData;

      if (!animeImageData && !animeImageUrl) {
        throw new Error("No anime image data returned");
      }

      let animeStorageUrl;

      if (animeImageData) {
        // Use base64 data directly
        console.log("Using base64 image data");
        animeStorageUrl = await uploadBase64Image(
          animeImageData,
          `${user.id}-anime-${timestamp}.png`
        );
      } else {
        // Fallback to downloading from URL
        console.log("Using URL fallback");
        const animeFileName = `${user.id}-anime-${timestamp}.png`;
        animeStorageUrl = await downloadAndUploadImage(
          animeImageUrl,
          animeFileName
        );
      }

      // Update profile with both URLs
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          avatar_url: animeStorageUrl, // Default display is anime version
          original_avatar_url: originalUrl,
          anime_avatar_url: animeStorageUrl,
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("Update error:", updateError);
        setError("Failed to update profile");
        return;
      }

      // Refresh profile data
      await fetchProfile();
    } catch (err) {
      console.error("Image upload error:", err);
      setError(
        `Failed to process image: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    } finally {
      setUploading(false);
      setGeneratingAnime(false);
    }
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
        <div
          className="absolute inset-0 opacity-10 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/cute-anime-landscape.jpg')",
          }}
        />
        <Card className="w-full max-w-md relative z-10 backdrop-blur-sm bg-background/80 border-border/50">
          <CardContent className="pt-6 text-center">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Heart className="w-5 h-5 text-primary-foreground" />
            </div>
            <p className="text-muted-foreground">Loading your profile...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
        <div
          className="absolute inset-0 opacity-10 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/cute-anime-landscape.jpg')",
          }}
        />
        <Card className="w-full max-w-md relative z-10 backdrop-blur-sm bg-background/80 border-border/50">
          <CardContent className="pt-6 text-center">
            <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Profile Not Found</h2>
            <p className="text-muted-foreground mb-4">
              We couldn't find your profile. Please try refreshing the page.
            </p>
            <Button onClick={() => window.location.reload()}>
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentLevel = profile?.level || 1;
  const currentAura = profile?.aura_points || 0;
  const levelTitle = getLevelTitle(currentLevel);
  const levelDescription = getLevelDescription(currentLevel);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 opacity-10 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/cute-anime-landscape.jpg')",
        }}
      />

      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-50 relative">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/homescreen">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Link>
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Heart className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-foreground">AniDate</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-4xl mx-auto">
          {error && (
            <Card className="mb-6 border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <p className="text-red-600">{error}</p>
              </CardContent>
            </Card>
          )}

          {(uploading || generatingAnime) && (
            <Card className="mb-6 border-blue-200 bg-blue-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-blue-600">
                    {uploading
                      ? "Uploading image..."
                      : generatingAnime
                      ? "Creating anime character..."
                      : "Processing..."}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Aura Points Section - NEW */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Aura Points & Level
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Level Display */}
              <div className="text-center space-y-2">
                <LevelDisplay level={currentLevel} size="lg" />
                <h3 className="text-lg font-semibold">{levelTitle}</h3>
                <p className="text-sm text-muted-foreground">
                  {levelDescription}
                </p>
              </div>

              {/* XP Bar */}
              <XPBar currentXP={currentAura} level={currentLevel} size="lg" />

              {/* Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-primary">
                    {currentAura.toLocaleString()}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Aura Points
                  </div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-secondary">
                    {profile?.total_aura_earned?.toLocaleString() || 0}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Lifetime Earned
                  </div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-accent">
                    {currentLevel}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Current Level
                  </div>
                </div>
              </div>

              {/* Next Milestone */}
              <div className="p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/20">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-4 h-4 text-primary" />
                  <span className="font-semibold">Next Milestone</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Keep practicing with AI characters to earn more aura points
                  and level up!
                </p>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="preferences">Preferences</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profile Card */}
                <Card className="lg:col-span-1">
                  <CardHeader className="text-center">
                    <div className="relative mx-auto w-32 h-32 mb-4">
                      <Avatar className="w-full h-full">
                        <AvatarImage
                          src={
                            showOriginalImage && profile.original_avatar_url
                              ? profile.original_avatar_url
                              : profile.anime_avatar_url ||
                                profile.avatar_url ||
                                ""
                          }
                          alt={profile.full_name}
                        />
                        <AvatarFallback className="text-2xl">
                          {profile.full_name?.[0] || "?"}
                        </AvatarFallback>
                      </Avatar>
                      {editing && (
                        <>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                            id="avatar-upload"
                            disabled={uploading}
                          />
                          <Button
                            size="icon"
                            className="absolute bottom-0 right-0 rounded-full"
                            variant="secondary"
                            onClick={() =>
                              document.getElementById("avatar-upload")?.click()
                            }
                            disabled={uploading || generatingAnime}
                          >
                            {uploading ? (
                              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            ) : generatingAnime ? (
                              <div className="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Camera className="w-4 h-4" />
                            )}
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Image Toggle Button */}
                    {profile.original_avatar_url &&
                      profile.anime_avatar_url && (
                        <div className="mb-4 flex flex-col items-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setShowOriginalImage(!showOriginalImage)
                            }
                            className="flex items-center gap-2"
                          >
                            {showOriginalImage ? (
                              <>
                                <EyeOff className="w-4 h-4" />
                                Show Anime Version
                              </>
                            ) : (
                              <>
                                <Eye className="w-4 h-4" />
                                Show Original
                              </>
                            )}
                          </Button>
                          <p className="text-xs text-muted-foreground mt-1">
                            {showOriginalImage
                              ? "Original photo"
                              : "Anime version"}
                          </p>
                        </div>
                      )}
                    <CardTitle className="text-2xl">
                      {profile.full_name}
                    </CardTitle>
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>{profile.age} years old</span>
                    </div>
                    <div className="flex items-center justify-center gap-1 text-muted-foreground">
                      <MapPin className="w-4 h-4" />
                      <span>{profile.location}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium">Bio</Label>
                        {editing ? (
                          <Textarea
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Tell us about yourself..."
                            className="mt-1"
                            rows={4}
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1">
                            {profile.bio || "No bio provided"}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label className="text-sm font-medium">Interests</Label>
                        {editing ? (
                          <div className="grid grid-cols-2 gap-2 mt-2">
                            {INTERESTS.map((interest) => (
                              <div
                                key={interest}
                                className="flex items-center space-x-2"
                              >
                                <input
                                  type="checkbox"
                                  id={interest}
                                  checked={interests.includes(interest)}
                                  onChange={() =>
                                    handleInterestToggle(interest)
                                  }
                                  className="rounded"
                                />
                                <Label htmlFor={interest} className="text-sm">
                                  {interest}
                                </Label>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {profile.interests?.map((interest) => (
                              <Badge key={interest} variant="secondary">
                                {interest}
                              </Badge>
                            )) || (
                              <span className="text-sm text-muted-foreground">
                                No interests selected
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Edit Profile Button */}
                      <div className="mt-6 pt-4 border-t border-border/50">
                        {editing ? (
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleCancel}
                              className="flex-1"
                            >
                              <X className="w-4 h-4 mr-2" />
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={handleSave}
                              disabled={saving}
                              className="flex-1"
                            >
                              <Save className="w-4 h-4 mr-2" />
                              {saving ? "Saving..." : "Save"}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditing(true)}
                            className="w-full"
                          >
                            <Edit3 className="w-4 h-4 mr-2" />
                            Edit Profile
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Stats and Info */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Basic Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Basic Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Full Name</Label>
                          {editing ? (
                            <Input
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              className="mt-1"
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground mt-1">
                              {profile.full_name}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>Age</Label>
                          {editing ? (
                            <Input
                              type="number"
                              value={age}
                              onChange={(e) => setAge(e.target.value)}
                              className="mt-1"
                              min="18"
                              max="100"
                            />
                          ) : (
                            <p className="text-sm text-muted-foreground mt-1">
                              {profile.age}
                            </p>
                          )}
                        </div>
                      </div>
                      <div>
                        <Label>Location</Label>
                        {editing ? (
                          <Input
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            placeholder="City, State"
                            className="mt-1"
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1">
                            {profile.location}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>Email</Label>
                        <p className="text-sm text-muted-foreground mt-1">
                          {profile.email}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Dating Preferences */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Dating Preferences</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Gender</Label>
                          {editing ? (
                            <Select value={gender} onValueChange={setGender}>
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Select your gender" />
                              </SelectTrigger>
                              <SelectContent>
                                {GENDER_OPTIONS.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-sm text-muted-foreground mt-1">
                              {GENDER_OPTIONS.find(
                                (opt) => opt.value === profile.gender
                              )?.label || profile.gender}
                            </p>
                          )}
                        </div>
                        <div>
                          <Label>Looking For</Label>
                          {editing ? (
                            <Select
                              value={lookingFor}
                              onValueChange={setLookingFor}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue placeholder="Who are you looking for?" />
                              </SelectTrigger>
                              <SelectContent>
                                {LOOKING_FOR_OPTIONS.map((option) => (
                                  <SelectItem
                                    key={option.value}
                                    value={option.value}
                                  >
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-sm text-muted-foreground mt-1">
                              {LOOKING_FOR_OPTIONS.find(
                                (opt) => opt.value === profile.looking_for
                              )?.label || profile.looking_for}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Activity Stats */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-2xl font-bold text-primary">
                            0
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Matches
                          </div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-secondary">
                            0
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Messages
                          </div>
                        </div>
                        <div>
                          <div className="text-2xl font-bold text-accent">
                            0
                          </div>
                          <div className="text-sm text-muted-foreground">
                            AI Chats
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* Preferences Tab */}
            <TabsContent value="preferences" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Dating Preferences */}
                <Card>
                  <CardHeader>
                    <CardTitle>Dating Preferences</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Set your preferences for potential matches
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label className="text-base">Age Range</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Preferred age range for matches
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm">Min Age</Label>
                          <Input
                            type="number"
                            placeholder="18"
                            min="18"
                            max="100"
                            className="mt-1"
                            value={preferences.ageRangeMin}
                            onChange={(e) =>
                              setPreferences((prev) => ({
                                ...prev,
                                ageRangeMin: parseInt(e.target.value) || 18,
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Max Age</Label>
                          <Input
                            type="number"
                            placeholder="30"
                            min="18"
                            max="100"
                            className="mt-1"
                            value={preferences.ageRangeMax}
                            onChange={(e) =>
                              setPreferences((prev) => ({
                                ...prev,
                                ageRangeMax: parseInt(e.target.value) || 30,
                              }))
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-base">Distance</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Maximum distance for matches
                      </p>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select distance" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 mile</SelectItem>
                          <SelectItem value="5">5 miles</SelectItem>
                          <SelectItem value="10">10 miles</SelectItem>
                          <SelectItem value="25">25 miles</SelectItem>
                          <SelectItem value="50">50 miles</SelectItem>
                          <SelectItem value="100">100 miles</SelectItem>
                          <SelectItem value="999">Any distance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-base">Relationship Type</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        What are you looking for?
                      </p>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select relationship type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="casual">Casual Dating</SelectItem>
                          <SelectItem value="serious">
                            Serious Relationship
                          </SelectItem>
                          <SelectItem value="friendship">Friendship</SelectItem>
                          <SelectItem value="any">Open to anything</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-base">Interested In</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Select all that apply
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {INTERESTS.map((interest) => (
                          <div
                            key={interest}
                            className="flex items-center space-x-2"
                          >
                            <input
                              type="checkbox"
                              id={`pref-${interest}`}
                              checked={preferences.interestedIn.includes(
                                interest
                              )}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setPreferences((prev) => ({
                                    ...prev,
                                    interestedIn: [
                                      ...prev.interestedIn,
                                      interest,
                                    ],
                                  }));
                                } else {
                                  setPreferences((prev) => ({
                                    ...prev,
                                    interestedIn: prev.interestedIn.filter(
                                      (i) => i !== interest
                                    ),
                                  }));
                                }
                              }}
                            />
                            <Label
                              htmlFor={`pref-${interest}`}
                              className="text-sm"
                            >
                              {interest}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Notification Preferences */}
                <Card>
                  <CardHeader>
                    <CardTitle>Notification Preferences</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Choose what notifications you want to receive
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">New Matches</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified when someone likes you
                        </p>
                      </div>
                      <Button
                        variant={preferences.newMatches ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setPreferences((prev) => ({
                            ...prev,
                            newMatches: !prev.newMatches,
                          }))
                        }
                      >
                        {preferences.newMatches ? "On" : "Off"}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Messages</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified of new messages
                        </p>
                      </div>
                      <Button
                        variant={preferences.messages ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setPreferences((prev) => ({
                            ...prev,
                            messages: !prev.messages,
                          }))
                        }
                      >
                        {preferences.messages ? "On" : "Off"}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Profile Views</Label>
                        <p className="text-sm text-muted-foreground">
                          Get notified when someone views your profile
                        </p>
                      </div>
                      <Button
                        variant={
                          preferences.profileViews ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() =>
                          setPreferences((prev) => ({
                            ...prev,
                            profileViews: !prev.profileViews,
                          }))
                        }
                      >
                        {preferences.profileViews ? "On" : "Off"}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">
                          AI Practice Reminders
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Reminders to practice with AI characters
                        </p>
                      </div>
                      <Button
                        variant={
                          preferences.aiPracticeReminders
                            ? "default"
                            : "outline"
                        }
                        size="sm"
                        onClick={() =>
                          setPreferences((prev) => ({
                            ...prev,
                            aiPracticeReminders: !prev.aiPracticeReminders,
                          }))
                        }
                      >
                        {preferences.aiPracticeReminders ? "On" : "Off"}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Weekly Summary</Label>
                        <p className="text-sm text-muted-foreground">
                          Weekly activity summary emails
                        </p>
                      </div>
                      <Button
                        variant={
                          preferences.weeklySummary ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() =>
                          setPreferences((prev) => ({
                            ...prev,
                            weeklySummary: !prev.weeklySummary,
                          }))
                        }
                      >
                        {preferences.weeklySummary ? "On" : "Off"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Practice Preferences */}
                <Card>
                  <CardHeader>
                    <CardTitle>AI Practice Settings</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Customize your AI conversation experience
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label className="text-base">
                        Preferred Character Types
                      </Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        What types of AI characters do you prefer?
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="romantic"
                            className="rounded"
                          />
                          <Label htmlFor="romantic" className="text-sm">
                            Romantic
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="friendly"
                            className="rounded"
                          />
                          <Label htmlFor="friendly" className="text-sm">
                            Friendly
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="flirty"
                            className="rounded"
                          />
                          <Label htmlFor="flirty" className="text-sm">
                            Flirty
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input type="checkbox" id="shy" className="rounded" />
                          <Label htmlFor="shy" className="text-sm">
                            Shy
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="confident"
                            className="rounded"
                          />
                          <Label htmlFor="confident" className="text-sm">
                            Confident
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            id="humorous"
                            className="rounded"
                          />
                          <Label htmlFor="humorous" className="text-sm">
                            Humorous
                          </Label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-base">
                        Conversation Difficulty
                      </Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Choose your preferred conversation level
                      </p>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select difficulty" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="beginner">
                            Beginner - Simple conversations
                          </SelectItem>
                          <SelectItem value="intermediate">
                            Intermediate - Normal conversations
                          </SelectItem>
                          <SelectItem value="advanced">
                            Advanced - Complex conversations
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Practice Mode</Label>
                        <p className="text-sm text-muted-foreground">
                          Enable practice mode for learning
                        </p>
                      </div>
                      <Button variant="default" size="sm">
                        On
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* App Preferences */}
                <Card>
                  <CardHeader>
                    <CardTitle>App Preferences</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Customize your app experience
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div>
                      <Label className="text-base">Theme</Label>
                      <p className="text-sm text-muted-foreground mb-3">
                        Choose your preferred theme
                      </p>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Select theme" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">Light Mode</SelectItem>
                          <SelectItem value="dark">Dark Mode</SelectItem>
                          <SelectItem value="system">Auto (System)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Anime Filters</Label>
                        <p className="text-sm text-muted-foreground">
                          Enable anime-style profile filters
                        </p>
                      </div>
                      <Button variant="default" size="sm">
                        On
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Sound Effects</Label>
                        <p className="text-sm text-muted-foreground">
                          Play sounds for notifications
                        </p>
                      </div>
                      <Button
                        variant={
                          preferences.soundEffects ? "default" : "outline"
                        }
                        size="sm"
                        onClick={() => {
                          const newValue = !preferences.soundEffects;
                          setPreferences((prev) => ({
                            ...prev,
                            soundEffects: newValue,
                          }));
                          soundManager.setEnabled(newValue);
                        }}
                      >
                        {preferences.soundEffects ? "On" : "Off"}
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Vibration</Label>
                        <p className="text-sm text-muted-foreground">
                          Vibrate for notifications
                        </p>
                      </div>
                      <Button variant="outline" size="sm">
                        Off
                      </Button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base">Location Services</Label>
                        <p className="text-sm text-muted-foreground">
                          Use location for nearby matches
                        </p>
                      </div>
                      <Button variant="default" size="sm">
                        On
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
