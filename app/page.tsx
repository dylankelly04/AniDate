"use client";

import { Button } from "@/components/ui/button";
import {
  Heart,
  Sparkles,
  MessageCircle,
  Shield,
  Users,
  LogOut,
  User,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();

  // Redirect authenticated users to homescreen
  useEffect(() => {
    if (!loading && user) {
      router.push("/homescreen");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto mb-4">
            <Heart className="w-5 h-5 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-20 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/cute-anime-landscape.jpg')",
        }}
      />

      <div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-30 hidden lg:block">
        <img src="/anime-girl-left.jpg" alt="" className="w-64 h-auto" />
      </div>

      <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-30 hidden lg:block">
        <img src="/anime-girl-right.jpg" alt="" className="w-64 h-auto" />
      </div>

      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm bg-background/80 sticky top-0 z-50 relative">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Heart className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">AniDate</span>
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Welcome, {user.user_metadata?.full_name || user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">Sign Up</Button>
              </Link>
            </div>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-16 md:py-24 relative z-10">
        <div className="text-center max-w-4xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 border border-accent/30 mb-8">
            <Sparkles className="w-4 h-4 text-accent-foreground" />
            <span className="text-sm font-medium text-accent-foreground">
              Practice dating with AI • Connect with real people
            </span>
          </div>

          {/* Main Headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 text-balance">
            <span className="bg-gradient-to-br from-primary to-secondary bg-clip-text text-transparent">
              Master the art of
            </span>
            <br />
            <span className="text-foreground">dating with anime</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto text-pretty">
            Practice your conversation skills with AI anime characters, then
            connect with real people through beautiful anime filters. Build
            confidence, make connections.
          </p>

          {/* CTA Button */}
          {user ? (
            <Button
              size="lg"
              className="text-lg px-8 py-6 h-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200 mb-16"
            >
              Start Dating Practice
              <Heart className="w-5 h-5 ml-2" />
            </Button>
          ) : (
            <Link href="/signup">
              <Button
                size="lg"
                className="text-lg px-8 py-6 h-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-200 mb-16"
              >
                Get Started
                <Heart className="w-5 h-5 ml-2" />
              </Button>
            </Link>
          )}

          {/* Features */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <MessageCircle className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                AI Practice
              </h3>
              <p className="text-sm text-muted-foreground">
                Chat with AI anime characters to build confidence
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-secondary/10 flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-secondary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                Anime Filters
              </h3>
              <p className="text-sm text-muted-foreground">
                Connect with real people through beautiful anime avatars
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                Real Connections
              </h3>
              <p className="text-sm text-muted-foreground">
                Make genuine connections in a comfortable environment
              </p>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="mt-16 text-center">
            <p className="text-sm text-muted-foreground">
              Join thousands building confidence in dating
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 mt-24">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Heart className="w-4 h-4" />
            <span className="text-sm">Made for HackGT '25, with Love</span>
            <Heart className="w-4 h-4" />
          </div>
        </div>
      </footer>
    </div>
  );
}
