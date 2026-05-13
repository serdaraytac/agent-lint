import { describe, it, expect } from "vitest";
import { detectPlatform, parseConfig } from "./parser.js";

describe("detectPlatform", () => {
  it("detects Claude from CLAUDE.md", () => {
    expect(detectPlatform("CLAUDE.md")).toBe("claude");
  });

  it("detects Claude from claude.local.md", () => {
    expect(detectPlatform("claude.local.md")).toBe("claude");
  });

  it("detects Cursor from .cursorrules", () => {
    expect(detectPlatform(".cursorrules")).toBe("cursor");
  });

  it("detects Cline from .clinerules", () => {
    expect(detectPlatform(".clinerules")).toBe("cline");
  });

  it("detects Codex from CODEX.md", () => {
    expect(detectPlatform("CODEX.md")).toBe("codex");
  });

  it("detects Gemini from GEMINI.md", () => {
    expect(detectPlatform("GEMINI.md")).toBe("gemini");
  });

  it("detects Copilot from copilot-instructions.md", () => {
    expect(detectPlatform("copilot-instructions.md")).toBe("copilot");
  });

  it("detects Windsurf from .windsurfrules", () => {
    expect(detectPlatform(".windsurfrules")).toBe("windsurf");
  });

  it("detects from nested path", () => {
    expect(detectPlatform("/project/.github/copilot-instructions.md")).toBe("copilot");
  });

  it("returns unknown for unrecognized filename", () => {
    expect(detectPlatform("my-rules.md")).toBe("unknown");
  });
});

describe("parseConfig", () => {
  const sample = `# Project Rules

## Coding Style
Use tabs for indentation.

## Testing
Write tests for all new code.
`;

  it("parses sections correctly", () => {
    const result = parseConfig("CLAUDE.md", sample);
    expect(result.sections).toHaveLength(3);
    expect(result.sections[0].heading).toBe("Project Rules");
    expect(result.sections[0].level).toBe(1);
    expect(result.sections[1].heading).toBe("Coding Style");
    expect(result.sections[2].heading).toBe("Testing");
  });

  it("sets correct platform", () => {
    const result = parseConfig("CLAUDE.md", sample);
    expect(result.platform).toBe("claude");
  });

  it("counts words and chars", () => {
    const result = parseConfig("CLAUDE.md", sample);
    expect(result.wordCount).toBeGreaterThan(0);
    expect(result.charCount).toBe(sample.length);
  });

  it("splits lines correctly", () => {
    const result = parseConfig("CLAUDE.md", sample);
    expect(result.lines.length).toBe(sample.split("\n").length);
  });

  it("handles empty content", () => {
    const result = parseConfig("CLAUDE.md", "");
    expect(result.sections).toHaveLength(0);
    expect(result.wordCount).toBe(0);
    expect(result.charCount).toBe(0);
  });

  it("section content excludes heading line", () => {
    const result = parseConfig("CLAUDE.md", sample);
    const codingSection = result.sections[1];
    expect(codingSection.content).toContain("Use tabs for indentation.");
    expect(codingSection.content).not.toContain("## Coding Style");
  });
});
