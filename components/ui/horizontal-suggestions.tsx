"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb,
  Sparkles,
  Heart,
  MessageCircle,
  Brain,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ConversationSuggestion {
  text: string;
  tone: "casual" | "flirty" | "deep" | "funny" | "supportive";
}

interface HorizontalSuggestionsProps {
  onSuggestionSelect: (suggestion: string) => void;
  onGenerateSuggestions: () => Promise<ConversationSuggestion[]>;
  disabled?: boolean;
  className?: string;
}

const toneConfig = {
  casual: {
    icon: MessageCircle,
    label: "Casual",
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
  flirty: {
    icon: Heart,
    label: "Flirty",
    color: "bg-pink-100 text-pink-800 border-pink-200",
  },
  deep: {
    icon: Brain,
    label: "Deep",
    color: "bg-purple-100 text-purple-800 border-purple-200",
  },
  funny: {
    icon: Sparkles,
    label: "Funny",
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
  },
  supportive: {
    icon: Heart,
    label: "Supportive",
    color: "bg-green-100 text-green-800 border-green-200",
  },
};

// Ani - The AI Assistant Anime Girl Icon
const AniIcon = ({ className }: { className?: string }) => (
  <div className={cn("relative", className)}>
    {/* Anime girl face */}
    <div className="w-8 h-8 bg-gradient-to-br from-pink-200 to-purple-200 rounded-full flex items-center justify-center border-2 border-pink-300">
      {/* Eyes */}
      <div className="flex gap-1">
        <div className="w-1.5 h-1.5 bg-pink-600 rounded-full"></div>
        <div className="w-1.5 h-1.5 bg-pink-600 rounded-full"></div>
      </div>
      {/* Blush */}
      <div className="absolute -bottom-0.5 -left-1 w-1 h-1 bg-pink-300 rounded-full"></div>
      <div className="absolute -bottom-0.5 -right-1 w-1 h-1 bg-pink-300 rounded-full"></div>
    </div>
    {/* Sparkle effect */}
    <div className="absolute -top-1 -right-1 w-2 h-2">
      <Sparkles className="w-2 h-2 text-yellow-400" />
    </div>
  </div>
);

export function HorizontalSuggestions({
  onSuggestionSelect,
  onGenerateSuggestions,
  disabled = false,
  className,
}: HorizontalSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<ConversationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const handleGenerateSuggestions = async () => {
    setLoading(true);
    try {
      const newSuggestions = await onGenerateSuggestions();
      setSuggestions(newSuggestions);
      setShowSuggestions(true);
    } catch (error) {
      console.error("Error generating suggestions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: ConversationSuggestion) => {
    onSuggestionSelect(suggestion.text);
    setShowSuggestions(false);
  };

  // Render suggestions in external container
  useEffect(() => {
    const container = document.getElementById("suggestions-container");
    if (container) {
      if (showSuggestions && suggestions.length > 0) {
        container.innerHTML = `
          <div class="border-pink-200 bg-pink-50/50 rounded-lg border p-4">
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2 text-sm font-medium text-pink-700">
                  <div class="w-6 h-6 bg-gradient-to-br from-pink-200 to-purple-200 rounded-full flex items-center justify-center border border-pink-300">
                    <div class="flex gap-0.5">
                      <div class="w-1 h-1 bg-pink-600 rounded-full"></div>
                      <div class="w-1 h-1 bg-pink-600 rounded-full"></div>
                    </div>
                  </div>
                  <span>Ani's Suggestions</span>
                </div>
                <button class="h-6 w-6 p-0 hover:bg-gray-100 rounded" onclick="this.closest('.border-pink-200').remove()">
                  <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>
              <div class="space-y-2">
                ${suggestions
                  .map(
                    (suggestion, index) => `
                  <div class="group cursor-pointer" onclick="window.selectSuggestion('${suggestion.text.replace(
                    /'/g,
                    "\\'"
                  )}')">
                    <div class="flex items-start gap-3 p-3 rounded-lg border border-transparent hover:border-pink-300 hover:bg-pink-100 transition-colors">
                      <span class="flex items-center gap-1 text-xs px-2 py-1 rounded border ${getToneColor(
                        suggestion.tone
                      )}">
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path>
                        </svg>
                        ${suggestion.tone}
                      </span>
                      <p class="text-sm flex-1 group-hover:text-pink-800 text-gray-700 transition-colors">
                        ${suggestion.text}
                      </p>
                    </div>
                  </div>
                `
                  )
                  .join("")}
              </div>
            </div>
          </div>
        `;
      } else {
        container.innerHTML = "";
      }
    }
  }, [showSuggestions, suggestions]);

  const getToneColor = (tone: string) => {
    const colors = {
      casual: "bg-blue-100 text-blue-800 border-blue-200",
      flirty: "bg-pink-100 text-pink-800 border-pink-200",
      deep: "bg-purple-100 text-purple-800 border-purple-200",
      funny: "bg-yellow-100 text-yellow-800 border-yellow-200",
      supportive: "bg-green-100 text-green-800 border-green-200",
    };
    return colors[tone as keyof typeof colors] || colors.casual;
  };

  // Global function for suggestion selection
  useEffect(() => {
    (window as any).selectSuggestion = (text: string) => {
      onSuggestionSelect(text);
      setShowSuggestions(false);
    };
  }, [onSuggestionSelect]);

  return (
    <div className={cn("relative", className)}>
      {/* Ani Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleGenerateSuggestions}
        disabled={disabled || loading}
        className="h-10 px-3 bg-gradient-to-r from-pink-50 to-purple-50 border-pink-200 hover:from-pink-100 hover:to-purple-100 hover:border-pink-300 transition-all duration-200"
      >
        <AniIcon className="mr-2" />
        <span className="text-sm font-medium text-pink-700">
          {loading ? "Thinking..." : "Ask Ani"}
        </span>
      </Button>
    </div>
  );
}
