import { describe, expect, it } from "@jest/globals";
import {
  TERMINAL_ARTIFACT_REFETCH_MAX_ATTEMPTS,
  claimTerminalArtifactRetryAttempt,
  getTerminalArtifactRetryDelayMs,
  getTerminalArtifactRetryKey,
  getHistoryRefetchModeForTerminalEvent,
  getTerminalEventArtifactIds,
  hasMissingTerminalArtifacts,
  shouldRefetchHistoryForTerminalEvent,
} from "./ConversationProvider";
import { shouldConnectConversationEvents } from "./conversation-event-connection";

describe("shouldConnectConversationEvents", () => {
  it("does not connect without a conversation id", () => {
    expect(shouldConnectConversationEvents(null, true, false, null)).toBe(false);
  });

  it("does not connect for non-live conversations", () => {
    expect(shouldConnectConversationEvents("c1", false, false, null)).toBe(false);
  });

  it("allows immediate SSE for a newly created pending route", () => {
    expect(shouldConnectConversationEvents("c1", true, true, "c1")).toBe(true);
  });

  it("waits for history validation on restored live conversations", () => {
    expect(shouldConnectConversationEvents("c1", true, true, null)).toBe(false);
    expect(shouldConnectConversationEvents("c1", true, false, null)).toBe(true);
  });
});

describe("shouldRefetchHistoryForTerminalEvent", () => {
  it("refetches history for terminal transcript events", () => {
    expect(shouldRefetchHistoryForTerminalEvent({
      type: "turn_complete",
      data: { result: "done" },
      timestamp: 1,
      iteration: 1,
    })).toBe(true);
    expect(shouldRefetchHistoryForTerminalEvent({
      type: "turn_cancelled",
      data: {},
      timestamp: 1,
      iteration: 1,
    })).toBe(true);
    expect(shouldRefetchHistoryForTerminalEvent({
      type: "task_error",
      data: { error: "boom" },
      timestamp: 1,
      iteration: 1,
    })).toBe(true);
  });

  it("also refetches when a turn ends on task_complete alone", () => {
    expect(shouldRefetchHistoryForTerminalEvent({
      type: "task_complete",
      data: { summary: "done" },
      timestamp: 1,
      iteration: 1,
    })).toBe(true);
  });
});

describe("getHistoryRefetchModeForTerminalEvent", () => {
  it("uses transcript-only refetches for canonical persisted transcript rows", () => {
    expect(getHistoryRefetchModeForTerminalEvent({
      type: "turn_complete",
      data: { result: "done" },
      timestamp: 1,
      iteration: 1,
    })).toBe("transcript");
    expect(getHistoryRefetchModeForTerminalEvent({
      type: "turn_cancelled",
      data: {},
      timestamp: 1,
      iteration: 1,
    })).toBe("transcript");
    expect(getHistoryRefetchModeForTerminalEvent({
      type: "task_error",
      data: { error: "boom" },
      timestamp: 1,
      iteration: 1,
    })).toBe("transcript");
  });

  it("uses full history refetches when task_complete is the only terminal transcript source", () => {
    expect(getHistoryRefetchModeForTerminalEvent({
      type: "task_complete",
      data: { summary: "done" },
      timestamp: 1,
      iteration: 1,
    })).toBe("all");
  });
});

describe("terminal artifact helpers", () => {
  it("extracts unique artifact ids from terminal events only", () => {
    expect(getTerminalEventArtifactIds({
      type: "turn_complete",
      data: { result: "done", artifact_ids: ["deck-1", "deck-1", "report-1"] },
      timestamp: 1,
      iteration: 1,
    })).toEqual(["deck-1", "report-1"]);

    expect(getTerminalEventArtifactIds({
      type: "task_complete",
      data: { summary: "done", artifact_ids: ["deck-1"] },
      timestamp: 1,
      iteration: 1,
    })).toEqual(["deck-1"]);

    expect(getTerminalEventArtifactIds({
      type: "tool_result",
      data: { tool_use_id: "tool-1", artifact_ids: ["deck-1"] },
      timestamp: 1,
      iteration: 1,
    })).toEqual([]);
  });

  it("detects terminal artifact ids missing from the rendered artifact list", () => {
    const terminalEvent = {
      type: "turn_complete" as const,
      data: { result: "done", artifact_ids: ["deck-1", "report-1"] },
      timestamp: 1,
      iteration: 1,
    };

    expect(hasMissingTerminalArtifacts(terminalEvent, [
      {
        id: "deck-1",
        name: "deck.pptx",
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        size: 42,
      },
    ])).toBe(true);

    expect(hasMissingTerminalArtifacts(terminalEvent, [
      {
        id: "deck-1",
        name: "deck.pptx",
        contentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        size: 42,
      },
      {
        id: "report-1",
        name: "report.pdf",
        contentType: "application/pdf",
        size: 24,
      },
    ])).toBe(false);
  });

  it("builds stable retry keys only for terminal events with artifact ids", () => {
    expect(getTerminalArtifactRetryKey({
      type: "turn_complete",
      data: { result: "done", artifact_ids: ["deck-1"] },
      timestamp: 1,
      iteration: 1,
    })).toBe("turn_complete:1:1:deck-1");

    expect(getTerminalArtifactRetryKey({
      type: "turn_complete",
      data: { result: "done" },
      timestamp: 1,
      iteration: 1,
    })).toBeNull();

    expect(getTerminalArtifactRetryKey({
      type: "tool_result",
      data: { tool_use_id: "tool-1", artifact_ids: ["deck-1"] },
      timestamp: 1,
      iteration: 1,
    })).toBeNull();
  });

  it("allows bounded repeated retry attempts for missing terminal artifacts", () => {
    const attempts = new Map<string, number>();
    const key = "turn_complete:1:1:deck-1";

    for (let attempt = 1; attempt <= TERMINAL_ARTIFACT_REFETCH_MAX_ATTEMPTS; attempt += 1) {
      expect(claimTerminalArtifactRetryAttempt(attempts, key)).toBe(attempt);
    }
    expect(claimTerminalArtifactRetryAttempt(attempts, key)).toBeNull();
  });

  it("uses capped exponential retry delays", () => {
    expect(getTerminalArtifactRetryDelayMs(1)).toBe(750);
    expect(getTerminalArtifactRetryDelayMs(2)).toBe(1500);
    expect(getTerminalArtifactRetryDelayMs(4)).toBe(6000);
    expect(getTerminalArtifactRetryDelayMs(5)).toBe(6000);
  });
});
