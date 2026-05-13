import { describe, it, expect } from "vitest";
import { getProfile } from "./platforms.js";
import type { Platform } from "./parser.js";

const ALL_PLATFORMS: Platform[] = [
  "claude", "cursor", "cline", "codex", "gemini",
  "copilot", "windsurf", "amp", "opencode", "warp",
  "kimi", "antigravity", "firebender", "unknown",
];

describe("getProfile", () => {
  it("returns a profile for every known platform", () => {
    for (const platform of ALL_PLATFORMS) {
      const profile = getProfile(platform);
      expect(profile, `missing profile for ${platform}`).toBeDefined();
    }
  });

  it("every profile has a non-empty displayName", () => {
    for (const platform of ALL_PLATFORMS) {
      expect(getProfile(platform).displayName.length).toBeGreaterThan(0);
    }
  });

  it("every profile has a positive contextWindowTokens", () => {
    for (const platform of ALL_PLATFORMS) {
      expect(getProfile(platform).contextWindowTokens).toBeGreaterThan(0);
    }
  });

  it("every profile has at least one expectedSection", () => {
    for (const platform of ALL_PLATFORMS) {
      expect(getProfile(platform).expectedSections.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("vaguenessSensitivity is in a sane range (0.5–2.0)", () => {
    for (const platform of ALL_PLATFORMS) {
      const s = getProfile(platform).vaguenessSensitivity;
      expect(s).toBeGreaterThanOrEqual(0.5);
      expect(s).toBeLessThanOrEqual(2.0);
    }
  });

  it("costPerMillion is zero for subscription-based platforms", () => {
    const subscriptionPlatforms: Platform[] = ["copilot", "codex", "windsurf", "warp", "antigravity", "firebender"];
    for (const platform of subscriptionPlatforms) {
      const profile = getProfile(platform);
      expect(profile.subscriptionBased).toBe(true);
      expect(profile.costPerMillion).toBe(0);
    }
  });

  it("claude profile is the baseline (sensitivity 1.0, $3/M)", () => {
    const claude = getProfile("claude");
    expect(claude.vaguenessSensitivity).toBe(1.0);
    expect(claude.costPerMillion).toBe(3.0);
    expect(claude.expectedSections).toContain("commands");
    expect(claude.expectedSections).toContain("rules");
  });

  it("codex and unknown share the highest vagueness sensitivity", () => {
    const maxSensitivity = Math.max(...ALL_PLATFORMS.map((p) => getProfile(p).vaguenessSensitivity));
    expect(getProfile("codex").vaguenessSensitivity).toBe(maxSensitivity);
    expect(getProfile("unknown").vaguenessSensitivity).toBe(maxSensitivity);
  });

  it("gemini has the largest context window among defined platforms", () => {
    const geminiWindow = getProfile("gemini").contextWindowTokens;
    const otherMax = ALL_PLATFORMS
      .filter((p) => p !== "gemini" && p !== "windsurf" && p !== "amp" && p !== "antigravity")
      .map((p) => getProfile(p).contextWindowTokens);
    expect(geminiWindow).toBeGreaterThanOrEqual(Math.max(...otherMax));
  });

  it("codex expectedSections includes pr-instructions and testing", () => {
    const sections = getProfile("codex").expectedSections;
    expect(sections).toContain("testing");
    expect(sections).toContain("pr-instructions");
  });

  it("gemini expectedSections reflects context-first structure", () => {
    const sections = getProfile("gemini").expectedSections;
    expect(sections).toContain("context");
    expect(sections).toContain("constraints");
  });
});
