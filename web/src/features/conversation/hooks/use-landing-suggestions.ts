"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchConversationSuggestions,
  type ConversationSuggestion,
} from "../api/history-api";
import { useAppStore } from "@/shared/stores";
import type { ConversationHistoryItem } from "@/shared/stores";

export type LandingSuggestion = ConversationSuggestion;

export function selectLandingSuggestionConversationId(
  lastOpenedConversationId: string | null,
  conversationHistory: readonly ConversationHistoryItem[],
): string | null {
  return lastOpenedConversationId ?? conversationHistory[0]?.id ?? null;
}

export function normalizeLandingSuggestions(
  suggestions: readonly ConversationSuggestion[] | undefined,
): readonly LandingSuggestion[] | null {
  if (!suggestions || suggestions.length !== 3) {
    return null;
  }

  const normalized: LandingSuggestion[] = [];
  const seenPrompts = new Set<string>();
  for (const suggestion of suggestions) {
    const label = suggestion.label.trim();
    const prompt = suggestion.prompt.trim();
    if (!label || !prompt) {
      return null;
    }
    const promptKey = prompt.toLocaleLowerCase();
    if (seenPrompts.has(promptKey)) {
      return null;
    }
    seenPrompts.add(promptKey);
    normalized.push({ label, prompt });
  }

  return normalized;
}

export function useLandingSuggestions(enabled = true): readonly LandingSuggestion[] | null {
  const lastOpenedConversationId = useAppStore((state) => state.lastOpenedConversationId);
  const conversationHistory = useAppStore((state) => state.conversationHistory);
  const sourceConversationId = useMemo(
    () => selectLandingSuggestionConversationId(
      lastOpenedConversationId,
      conversationHistory,
    ),
    [lastOpenedConversationId, conversationHistory],
  );
  const [suggestions, setSuggestions] = useState<readonly LandingSuggestion[] | null>(null);

  useEffect(() => {
    if (!enabled || !sourceConversationId) {
      setSuggestions(null);
      return;
    }

    const controller = new AbortController();
    setSuggestions(null);

    fetchConversationSuggestions(sourceConversationId, controller.signal)
      .then((response) => {
        setSuggestions(normalizeLandingSuggestions(response.suggestions));
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setSuggestions(null);
      });

    return () => controller.abort();
  }, [enabled, sourceConversationId]);

  return suggestions;
}
