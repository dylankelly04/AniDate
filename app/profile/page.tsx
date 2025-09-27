"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Heart,
  User,
  Camera,
  Star,
  Coins,
  TrendingUp,
  MapPin,
  GraduationCap,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface ProfileData {
  id: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  age: number | null;
  height: number | null;
  location: string | null;
  school: string | null;
  interests: string[];
  relationship_type: string;
  aura: number;
  experience_level: number;
  experience_points: number;
}

const RELATIONSHIP_TYPES = [
  { value: "casual", label: "Casual Dating" },
  { value: "serious", label: "Serious Relationship" },
  { value: "friendship", label: "Friendship" },
  { value: "not_sure", label: "Not Sure" },
];

const INTEREST_OPTIONS = [
  "Anime",
  "Manga",
  "Gaming",
  "Music",
  "Movies",
  "Reading",
  "Art",
  "Photography",
  "Cooking",
  "Travel",
  "Sports",
  "Fitness",
  "Dancing",
  "Singing",
  "Writing",
  "Technology",
  "Science",
  "Nature",
  "Animals",
  "Fashion",
  "Beauty",
  "Fitness",
];

export default function ProfilePage() {
  const { user } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    full_name: "",
    bio: "",
    age: "",
    height: "",
    location: "",
    school: "",
    relationship_type: "not_sure",
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (error && error.code === "PGRST116") {
        // Profile doesn't exist, create a default one
        const { data: newProfile, error: createError } = await supabase
          .from("profiles")
          .insert({
            id: user?.id,
            full_name: user?.user_metadata?.full_name || "",
            aura: 100,
            experience_level: 1,
            experience_points: 0,
            relationship_type: "not_sure",
          })
          .select()
          .single();

        if (createError) throw createError;

        setProfile(newProfile);
        setFormData({
          full_name: newProfile.full_name || "",
          bio: "",
          age: "",
          height: "",
          location: "",
          school: "",
          relationship_type: "not_sure",
        });
        setSelectedInterests([]);

        toast.success(
          "Welcome to AniDate! Complete your profile to get started."
        );
      } else if (error) {
        throw error;
      } else {
        setProfile(data);
        setFormData({
          full_name: data.full_name || "",
          bio: data.bio || "",
          age: data.age?.toString() || "",
          height: data.height?.toString() || "",
          location: data.location || "",
          school: data.school || "",
          relationship_type: data.relationship_type || "not_sure",
        });
        setSelectedInterests(data.interests || []);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: formData.full_name,
          bio: formData.bio,
          age: formData.age ? parseInt(formData.age) : null,
          height: formData.height ? parseInt(formData.height) : null,
          location: formData.location,
          school: formData.school,
          relationship_type: formData.relationship_type,
          interests: selectedInterests,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Profile updated successfully!");
      fetchProfile(); // Refresh profile data
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be smaller than 5MB");
      return;
    }

    try {
      // Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("user-avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("user-avatars").getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      toast.success("Profile picture updated!");
      fetchProfile(); // Refresh profile data
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    }
  };

  const addInterest = () => {
    if (
      newInterest &&
      selectedInterests.length < 3 &&
      !selectedInterests.includes(newInterest)
    ) {
      setSelectedInterests([...selectedInterests, newInterest]);
      setNewInterest("");
    }
  };

  const removeInterest = (interest: string) => {
    setSelectedInterests(selectedInterests.filter((i) => i !== interest));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto mb-4">
            <Heart className="w-5 h-5 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto mb-4">
            <Heart className="w-5 h-5 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Setting up your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 opacity-20 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/cute-anime-landscape.jpg')",
        }}
      />

      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-50 relative">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">AniDate</span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/homescreen")}
          >
            Back to Home
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Profile Stats Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Profile Picture & Stats */}
              <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                <CardContent className="p-6">
                  <div className="text-center">
                    {/* Avatar */}
                    <div className="relative inline-block mb-4">
                      <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                        {profile.avatar_url ? (
                          <img
                            src={profile.avatar_url}
                            alt="Profile"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-12 h-12 text-muted-foreground" />
                        )}
                      </div>
                      <label className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 cursor-pointer hover:bg-primary/90 transition-colors">
                        <Camera className="w-4 h-4" />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </label>
                    </div>

                    <h2 className="text-xl font-semibold mb-2">
                      {profile.full_name || "Complete Your Profile"}
                    </h2>
                    {!profile.full_name && (
                      <p className="text-sm text-muted-foreground mb-4">
                        Add your information below to get started!
                      </p>
                    )}

                    {/* Stats */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Coins className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm">Aura</span>
                        </div>
                        <span className="font-semibold">{profile.aura}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-blue-500" />
                          <span className="text-sm">Level</span>
                        </div>
                        <span className="font-semibold">
                          {profile.experience_level}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-green-500" />
                          <span className="text-sm">XP</span>
                        </div>
                        <span className="font-semibold">
                          {profile.experience_points}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Info */}
              <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg">Quick Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {profile.age && (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{profile.age} years old</span>
                    </div>
                  )}
                  {profile.height && (
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{profile.height} cm</span>
                    </div>
                  )}
                  {profile.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{profile.location}</span>
                    </div>
                  )}
                  {profile.school && (
                    <div className="flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{profile.school}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">
                      {
                        RELATIONSHIP_TYPES.find(
                          (t) => t.value === profile.relationship_type
                        )?.label
                      }
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Profile Form */}
            <div className="lg:col-span-2">
              <Card className="bg-background/80 backdrop-blur-sm border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    Edit Profile
                  </CardTitle>
                  <CardDescription>
                    {profile.full_name
                      ? "Update your profile information to help others get to know you better."
                      : "Complete your profile to start connecting with others on AniDate!"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Full Name</Label>
                      <Input
                        id="full_name"
                        value={formData.full_name}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            full_name: e.target.value,
                          })
                        }
                        placeholder="Enter your full name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="age">Age</Label>
                      <Input
                        id="age"
                        type="number"
                        value={formData.age}
                        onChange={(e) =>
                          setFormData({ ...formData, age: e.target.value })
                        }
                        placeholder="Enter your age"
                        min="18"
                        max="100"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="height">Height (cm)</Label>
                      <Input
                        id="height"
                        type="number"
                        value={formData.height}
                        onChange={(e) =>
                          setFormData({ ...formData, height: e.target.value })
                        }
                        placeholder="Enter your height"
                        min="100"
                        max="250"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) =>
                          setFormData({ ...formData, location: e.target.value })
                        }
                        placeholder="Enter your location"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="school">School/University</Label>
                    <Input
                      id="school"
                      value={formData.school}
                      onChange={(e) =>
                        setFormData({ ...formData, school: e.target.value })
                      }
                      placeholder="Enter your school or university"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="relationship_type">Looking for</Label>
                    <Select
                      value={formData.relationship_type}
                      onValueChange={(value) =>
                        setFormData({ ...formData, relationship_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select relationship type" />
                      </SelectTrigger>
                      <SelectContent>
                        {RELATIONSHIP_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={formData.bio}
                      onChange={(e) =>
                        setFormData({ ...formData, bio: e.target.value })
                      }
                      placeholder="Tell others about yourself..."
                      rows={4}
                    />
                  </div>

                  {/* Interests */}
                  <div className="space-y-4">
                    <Label>Interests ({selectedInterests.length}/3)</Label>

                    {/* Selected Interests */}
                    <div className="flex flex-wrap gap-2">
                      {selectedInterests.map((interest) => (
                        <Badge
                          key={interest}
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {interest}
                          <button
                            onClick={() => removeInterest(interest)}
                            className="ml-1 hover:text-destructive"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>

                    {/* Add Interest */}
                    {selectedInterests.length < 3 && (
                      <div className="flex gap-2">
                        <Input
                          value={newInterest}
                          onChange={(e) => setNewInterest(e.target.value)}
                          placeholder="Add an interest"
                          onKeyPress={(e) => e.key === "Enter" && addInterest()}
                        />
                        <Button onClick={addInterest} size="sm">
                          Add
                        </Button>
                      </div>
                    )}

                    {/* Interest Suggestions */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">
                        Suggestions:
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {INTEREST_OPTIONS.filter(
                          (interest) => !selectedInterests.includes(interest)
                        )
                          .slice(0, 10)
                          .map((interest) => (
                            <Button
                              key={interest}
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (selectedInterests.length < 3) {
                                  setSelectedInterests([
                                    ...selectedInterests,
                                    interest,
                                  ]);
                                }
                              }}
                              disabled={selectedInterests.length >= 3}
                            >
                              {interest}
                            </Button>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end pt-4 border-t border-border/30">
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      size="lg"
                      className="min-w-[140px]"
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
