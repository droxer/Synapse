import { describe, expect, it } from "@jest/globals";
import {
  EVENT_ROW_BASE_CLASSES,
  getActivityEntryKind,
  getActivityKindVisual,
  getToolCallTone,
  getToolCallVisualClasses,
} from "./format-tools";
import type { ToolCallInfo } from "@/shared/types";

function toolCallFixture(overrides: Partial<ToolCallInfo> = {}): ToolCallInfo {
  return {
    id: "1",
    toolUseId: "tu-1",
    name: "web_search",
    input: {},
    timestamp: 0,
    ...overrides,
  };
}

describe("activity visual helpers", () => {
  it("maps skill tools to skill kind", () => {
    expect(getActivityEntryKind("activate_skill")).toBe("skill");
    expect(getActivityEntryKind("load_skill")).toBe("skill");
  });

  it("maps non-skill tools to tool kind", () => {
    expect(getActivityEntryKind("web_search")).toBe("tool");
  });

  it("returns distinct row accents for tool and skill", () => {
    const tool = getActivityKindVisual("tool");
    const skill = getActivityKindVisual("skill");
    const neutral = getActivityKindVisual("neutral");

    expect(tool.rowAccent).toBe("");
    expect(skill.rowAccent).toBe("");
    expect(neutral.rowAccent).toBe("");
    expect(tool.rowHoverAccent).toBe("");
    expect(skill.rowHoverAccent).toBe("");
  });

  it("derives tool call tone from success and output", () => {
    expect(getToolCallTone(toolCallFixture({ success: false }))).toBe("error");
    expect(getToolCallTone(toolCallFixture({ success: true }))).toBe("complete");
    expect(getToolCallTone(toolCallFixture({ output: "ok" }))).toBe("complete");
    expect(getToolCallTone(toolCallFixture())).toBe("running");
  });

  it("maps tones to row utility classes (flat neutral rows + error tint)", () => {
    expect(getToolCallVisualClasses("running").row).toContain("bg-transparent");
    expect(getToolCallVisualClasses("complete").row).toContain("bg-transparent");
    expect(getToolCallVisualClasses("error").row).toContain("critical-strong");
    expect(getToolCallVisualClasses("running").rowHover).toContain("bg-muted");
  });

  it("keeps shared activity rows on the compact rounded-md rhythm", () => {
    expect(EVENT_ROW_BASE_CLASSES).toContain("rounded-md");
    expect(EVENT_ROW_BASE_CLASSES).not.toContain("rounded-xl");
    expect(EVENT_ROW_BASE_CLASSES).not.toContain("surface-panel");
  });
});
