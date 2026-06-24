import { describe, expect, it } from "@jest/globals";
import {
  normalizeLandingSuggestions,
  selectLandingSuggestionConversationId,
} from "./use-landing-suggestions";
import type { ConversationHistoryItem } from "@/shared/stores";

function historyItem(id: string): ConversationHistoryItem {
  return {
    id,
    title: id,
    timestamp: Date.now(),
    isRunning: false,
    orchestratorMode: null,
  };
}

describe("landing suggestions", () => {
  it("prefers the last opened conversation over the newest history item", () => {
    expect(
      selectLandingSuggestionConversationId("last-opened", [
        historyItem("newest"),
      ]),
    ).toBe("last-opened");
  });

  it("falls back to the newest history item when there is no last opened conversation", () => {
    expect(
      selectLandingSuggestionConversationId(null, [
        historyItem("newest"),
        historyItem("older"),
      ]),
    ).toBe("newest");
  });

  it("returns null when suggestions are missing or malformed", () => {
    expect(normalizeLandingSuggestions(undefined)).toBeNull();
    expect(normalizeLandingSuggestions([{ label: "One", prompt: "Question?" }])).toBeNull();
    expect(
      normalizeLandingSuggestions([
        { label: "One", prompt: "Question?" },
        { label: "Two", prompt: "Question?" },
        { label: "Three", prompt: "Another question?" },
      ]),
    ).toBeNull();
  });

  it("keeps exactly three usable suggestions", () => {
    expect(
      normalizeLandingSuggestions([
        { label: " One ", prompt: " First question? " },
        { label: "Two", prompt: "Second question?" },
        { label: "Three", prompt: "Third question?" },
      ]),
    ).toEqual([
      { label: "One", prompt: "First question?" },
      { label: "Two", prompt: "Second question?" },
      { label: "Three", prompt: "Third question?" },
    ]);
  });
});
