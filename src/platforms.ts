import type { Platform } from "./parser.js";

export interface PlatformProfile {
  displayName: string;
  primaryModel: string;
  contextWindowTokens: number;
  // USD per 1M input tokens. 0 for subscription-based platforms where per-token cost is not exposed.
  costPerMillion: number;
  subscriptionBased: boolean;
  expectedSections: string[];
  // Multiplier on CATEGORY_PENALTIES in scorer. Calibrated per GPT-4.1 literal-following research.
  // 1.0 = Claude baseline. Higher = more sensitive to vagueness.
  vaguenessSensitivity: number;
}

const PROFILES: Record<Platform, PlatformProfile> = {
  claude: {
    displayName: "Claude Code",
    primaryModel: "claude-sonnet-4-6",
    contextWindowTokens: 200_000,
    costPerMillion: 3.0,
    subscriptionBased: false,
    expectedSections: ["commands", "architecture", "rules", "style"],
    vaguenessSensitivity: 1.0,
  },
  cursor: {
    displayName: "Cursor",
    primaryModel: "claude-sonnet / gpt-4o (auto)",
    contextWindowTokens: 200_000,
    costPerMillion: 1.25,
    subscriptionBased: false,
    // GPT-4.1 follows instructions more literally — vagueness has higher cost
    expectedSections: ["rules", "style", "context"],
    vaguenessSensitivity: 1.2,
  },
  cline: {
    displayName: "Cline",
    primaryModel: "configurable (Claude Sonnet default)",
    contextWindowTokens: 200_000,
    costPerMillion: 3.0,
    subscriptionBased: false,
    expectedSections: ["rules", "context"],
    vaguenessSensitivity: 1.0,
  },
  codex: {
    displayName: "Codex (OpenAI)",
    primaryModel: "codex-1 / gpt-4.1",
    contextWindowTokens: 200_000,
    costPerMillion: 0,
    subscriptionBased: true,
    // codex-1 / GPT-4.1 is the most literal instruction follower — highest sensitivity
    expectedSections: ["conventions", "testing", "architecture", "pr-instructions"],
    vaguenessSensitivity: 1.3,
  },
  gemini: {
    displayName: "Gemini CLI",
    primaryModel: "gemini-2.5-pro",
    contextWindowTokens: 1_000_000,
    costPerMillion: 1.25,
    subscriptionBased: false,
    // Gemini docs recommend context-first, query-last ordering
    expectedSections: ["instructions", "context", "constraints"],
    vaguenessSensitivity: 1.0,
  },
  copilot: {
    displayName: "GitHub Copilot",
    primaryModel: "gpt-4o",
    contextWindowTokens: 192_000,
    costPerMillion: 0,
    subscriptionBased: true,
    expectedSections: ["instructions", "style"],
    vaguenessSensitivity: 1.2,
  },
  windsurf: {
    displayName: "Windsurf",
    primaryModel: "claude-sonnet",
    contextWindowTokens: 1_000_000,
    costPerMillion: 0,
    subscriptionBased: true,
    expectedSections: ["rules", "style"],
    vaguenessSensitivity: 1.0,
  },
  amp: {
    displayName: "Amp",
    primaryModel: "claude-opus-4-7",
    contextWindowTokens: 1_000_000,
    costPerMillion: 5.0,
    subscriptionBased: false,
    expectedSections: ["conventions", "testing"],
    vaguenessSensitivity: 1.0,
  },
  opencode: {
    displayName: "OpenCode",
    primaryModel: "configurable",
    contextWindowTokens: 131_072,
    costPerMillion: 3.0,
    subscriptionBased: false,
    expectedSections: ["rules"],
    vaguenessSensitivity: 1.1,
  },
  warp: {
    displayName: "Warp",
    primaryModel: "configurable",
    contextWindowTokens: 200_000,
    costPerMillion: 0,
    subscriptionBased: true,
    expectedSections: ["rules"],
    vaguenessSensitivity: 1.1,
  },
  kimi: {
    displayName: "Kimi Code CLI",
    primaryModel: "kimi-k2",
    contextWindowTokens: 200_000,
    costPerMillion: 0.5,
    subscriptionBased: false,
    expectedSections: ["rules"],
    vaguenessSensitivity: 1.1,
  },
  antigravity: {
    displayName: "Antigravity",
    primaryModel: "gemini-based",
    contextWindowTokens: 1_000_000,
    costPerMillion: 0,
    subscriptionBased: true,
    expectedSections: ["rules"],
    vaguenessSensitivity: 1.0,
  },
  firebender: {
    displayName: "Firebender",
    primaryModel: "unknown",
    contextWindowTokens: 200_000,
    costPerMillion: 0,
    subscriptionBased: true,
    expectedSections: ["rules"],
    vaguenessSensitivity: 1.1,
  },
  // Fallback for any platform not explicitly profiled.
  // Uses the most conservative values across known platforms:
  //   - vaguenessSensitivity: mirrors Codex (1.3) — highest known value, safest assumption
  //   - contextWindowTokens: 128k — smallest sensible modern window, strictest token-efficiency threshold
  //   - costPerMillion: Claude Sonnet rate ($3/M) — non-zero so cost warnings still surface
  //   - expectedSections: minimal ["rules"] — avoids false positives on unknown formats
  unknown: {
    displayName: "Unknown Platform",
    primaryModel: "unknown",
    contextWindowTokens: 128_000,
    costPerMillion: 3.0,
    subscriptionBased: false,
    expectedSections: ["rules"],
    vaguenessSensitivity: 1.3,
  },
};

export function getProfile(platform: Platform): PlatformProfile {
  return PROFILES[platform];
}
