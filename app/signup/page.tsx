"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Heart,
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Calendar,
  MapPin,
  FileText,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";

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

export default function SignupPage() {
  // Basic info
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");

  // Profile info
  const [age, setAge] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [gender, setGender] = useState("");
  const [lookingFor, setLookingFor] = useState("");
  const [interests, setInterests] = useState<string[]>([]);

  // UI state
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const router = useRouter();
  const supabase = createClient();

  const handleInterestToggle = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleNext = () => {
    if (currentStep === 1) {
      // Validate basic info
      if (!fullName || !email || !password || !confirmPassword) {
        setError("Please fill in all required fields");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters");
        return;
      }
      if (!email.includes("@")) {
        setError("Please enter a valid email address");
        return;
      }
    }
    setError("");
    setCurrentStep(2);
  };

  const handleBack = () => {
    setCurrentStep(1);
    setError("");
  };

  const createUserProfile = async (userId: string) => {
    console.log("Creating profile for user:", userId);

    // Check if profile already exists (might be created by trigger)
    const { data: existingProfile, error: fetchError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      console.error("Error checking existing profile:", fetchError);
    }

    // Profile data with all enhanced schema fields
    const profileData = {
      id: userId,
      full_name: fullName,
      email: email,
      age: parseInt(age),
      location,
      bio: bio || null,
      gender,
      looking_for: lookingFor,
      interests: interests,
      is_active: true,
      show_age: true,
      show_location: true,
      show_online_status: true,
      login_count: 1,
      profile_views: 0,
    };

    console.log("Profile data being inserted/updated:", profileData);

    try {
      let result;

      if (existingProfile) {
        console.log("Profile already exists, updating it");
        result = await supabase
          .from("profiles")
          .update(profileData)
          .eq("id", userId)
          .select();
      } else {
        console.log("Creating new profile");
        result = await supabase.from("profiles").insert(profileData).select();
      }

      console.log("Profile operation result:", result);

      if (result.error) {
        console.error("Supabase error with profile:", result.error);
        throw new Error(
          `Profile operation failed: ${result.error.message || "Unknown error"}`
        );
      }

      console.log("Profile operation successful:", result.data);
      return result.data;
    } catch (err) {
      console.error("Profile operation failed with error:", err);
      throw new Error(
        `Profile operation failed: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      );
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    // Validate profile info
    if (!age || !location || !gender || !lookingFor || interests.length === 0) {
      setError("Please fill in all required profile fields");
      setLoading(false);
      return;
    }

    const ageNum = parseInt(age);
    if (ageNum < 18 || ageNum > 100) {
      setError("Age must be between 18 and 100");
      setLoading(false);
      return;
    }

    if (interests.length < 3) {
      setError("Please select at least 3 interests");
      setLoading(false);
      return;
    }

    try {
      console.log("Starting signup process...");

      // Create user account with metadata
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            age: ageNum,
            location,
            bio: bio || null,
            gender,
            looking_for: lookingFor,
            interests: interests,
          },
        },
      });

      console.log("Auth signup result:", { authData, authError });

      if (authError) {
        console.error("Auth error:", authError);
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (authData.user) {
        console.log(
          "User created successfully! Profile should be created automatically by trigger."
        );

        // The trigger should create the profile automatically
        // Let's just wait a moment and then proceed
        await new Promise((resolve) => setTimeout(resolve, 1500));

        setSuccess(true);

        // Show success message for 2 seconds then redirect
        setTimeout(() => {
          router.push("/homescreen");
        }, 2000);
      } else {
        setError("Account creation failed - no user data returned");
      }
    } catch (err) {
      console.error("Signup error:", err);
      setError(
        `Signup failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Google signup disabled

  if (success) {
    return (
      <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
        <div
          className="absolute inset-0 opacity-20 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: "url('/cute-anime-landscape.jpg')",
          }}
        />
        <Card className="w-full max-w-md relative z-10 backdrop-blur-sm bg-background/80 border-border/50">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Account Created!</h2>
            <p className="text-muted-foreground mb-4">
              Welcome to AniDate! Your profile has been set up successfully.
              Redirecting you...
            </p>
            <div className="w-full bg-secondary rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full animate-pulse"
                style={{ width: "100%" }}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center">
      {/* Background */}
      <div
        className="absolute inset-0 opacity-20 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/cute-anime-landscape.jpg')",
        }}
      />

      <Card className="w-full max-w-2xl relative z-10 backdrop-blur-sm bg-background/80 border-border/50">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">AniDate</span>
          </div>
          <CardTitle className="text-2xl">Join AniDate</CardTitle>
          <CardDescription>
            {currentStep === 1
              ? "Create your account to get started"
              : "Tell us about yourself to find your perfect match"}
          </CardDescription>

          {/* Progress indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <div
              className={`w-3 h-3 rounded-full ${
                currentStep >= 1 ? "bg-primary" : "bg-muted"
              }`}
            />
            <div
              className={`w-8 h-1 rounded-full ${
                currentStep >= 2 ? "bg-primary" : "bg-muted"
              }`}
            />
            <div
              className={`w-3 h-3 rounded-full ${
                currentStep >= 2 ? "bg-primary" : "bg-muted"
              }`}
            />
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
              {error}
            </div>
          )}

          {currentStep === 1 ? (
            // Step 1: Basic Information
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleNext();
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-3 h-4 w-4 text-muted-foreground hover:text-foreground"
                  >
                    {showConfirmPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full">
                Continue
              </Button>
            </form>
          ) : (
            // Step 2: Profile Information
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="age">Age *</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="age"
                      type="number"
                      placeholder="Your age"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="pl-10"
                      min="18"
                      max="100"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="location"
                      type="text"
                      placeholder="City, State"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender">Gender *</Label>
                  <Select value={gender} onValueChange={setGender} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lookingFor">Looking for *</Label>
                  <Select
                    value={lookingFor}
                    onValueChange={setLookingFor}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Who are you looking for?" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOOKING_FOR_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Interests * (Select at least 3)</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {INTERESTS.map((interest) => (
                    <div key={interest} className="flex items-center space-x-2">
                      <Checkbox
                        id={interest}
                        checked={interests.includes(interest)}
                        onCheckedChange={() => handleInterestToggle(interest)}
                      />
                      <Label htmlFor={interest} className="text-sm">
                        {interest}
                      </Label>
                    </div>
                  ))}
                </div>
                {interests.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {interests.join(", ")}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio (Optional)</Label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Textarea
                    id="bio"
                    placeholder="Tell us about yourself..."
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="pl-10 min-h-[100px]"
                    maxLength={500}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {bio.length}/500 characters
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleBack}
                  className="flex-1"
                >
                  Back
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={loading || interests.length < 3}
                >
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </div>
            </form>
          )}

          {/* Google login disabled for signup */}

          <div className="text-center text-sm">
            <span className="text-muted-foreground">
              Already have an account?{" "}
            </span>
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
