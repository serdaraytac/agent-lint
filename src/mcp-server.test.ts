import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { writeFile, mkdir, rm } from "fs/promises";
import { resolve } from "path";
import { tmpdir } from "os";
import { parseConfig } from "./parser.js";
import { analyze } from "./analyzer.js";
import { score } from "./scorer.js";
import { optimize } from "./optimizer.js";
import { getProfile } from "./platforms.js";

// Tests exercise the plugin pipeline end-to-end without spinning up the MCP
// transport — we test the logic that the server handlers delegate to.

const SAMPLE_CONFIG = `# Project Rules

## Commands
- Build: \`npm run build\`
- Test: \`npm test\`

## Rules
- Always use TypeScript strict mode
- Never commit secrets

## Style
Use 2-space indentation.
`;

const VAGUE_CONFIG = `# Rules
Write good code that follows best practices.
Use appropriate naming when necessary.
`;

let tmpDir: string;
let sampleFile: string;
let vagueFile: string;

beforeAll(async () => {
  tmpDir = resolve(tmpdir(), `md-analyzer-test-${Date.now()}`);
  await mkdir(tmpDir, { recursive: true });
  sampleFile = resolve(tmpDir, "CLAUDE.md");
  vagueFile = resolve(tmpDir, ".cursorrules");
  await writeFile(sampleFile, SAMPLE_CONFIG, "utf-8");
  await writeFile(vagueFile, VAGUE_CONFIG, "utf-8");
});

afterAll(async () => {
  await rm(tmpDir, { recursive: true, force: true });
});

// Simulate what the MCP handler does after resolveInput succeeds
function runAnalyze(filename: string, content: string) {
  const config = parseConfig(filename, content);
  const analysis = analyze(config);
  const scoreResult = score(analysis);
  const profile = getProfile(config.platform);
  return {
    platform: config.platform,
    platformInfo: {
      displayName:          profile.displayName,
      primaryModel:         profile.primaryModel,
      contextWindowTokens:  profile.contextWindowTokens,
      vaguenessSensitivity: profile.vaguenessSensitivity,
      subscriptionBased:    profile.subscriptionBased,
    },
    filename: config.filename,
    score: {
      overall:    scoreResult.overall,
      grade:      scoreResult.grade,
      categories: scoreResult.categories,
    },
    tokenCount:        analysis.tokenCount,
    estimatedCostUsd:  profile.subscriptionBased ? null : analysis.estimatedCostUsd,
    issues:            analysis.issues,
  };
}

function runOptimize(filename: string, content: string) {
  const config = parseConfig(filename, content);
  const analysis = analyze(config);
  const scoreResult = score(analysis);
  const profile = getProfile(config.platform);
  const result = optimize(config, analysis, scoreResult);

  const optimizedConfig   = parseConfig(filename, result.optimizedContent);
  const optimizedAnalysis = analyze(optimizedConfig);
  const optimizedScore    = score(optimizedAnalysis);

  return {
    platform:     config.platform,
    platformInfo: {
      displayName:          profile.displayName,
      vaguenessSensitivity: profile.vaguenessSensitivity,
      subscriptionBased:    profile.subscriptionBased,
    },
    before:         { overall: scoreResult.overall,    grade: scoreResult.grade },
    after:          { overall: optimizedScore.overall, grade: optimizedScore.grade },
    scoreDelta:     optimizedScore.overall - scoreResult.overall,
    changesSummary: result.changesSummary,
    optimizedContent: result.optimizedContent,
  };
}

describe("analyze_config pipeline", () => {
  it("returns platform, score, and issues", () => {
    const result = runAnalyze("CLAUDE.md", SAMPLE_CONFIG);
    expect(result.platform).toBe("claude");
    expect(result.score.overall).toBeGreaterThanOrEqual(0);
    expect(result.score.overall).toBeLessThanOrEqual(100);
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it("detects platform from .cursorrules", () => {
    const result = runAnalyze(".cursorrules", VAGUE_CONFIG);
    expect(result.platform).toBe("cursor");
  });

  it("vague config produces vague rule issues", () => {
    const result = runAnalyze("CLAUDE.md", VAGUE_CONFIG);
    expect(result.issues.some((i) => i.code === "VAGUE_RULE")).toBe(true);
  });

  it("score categories are all defined", () => {
    const result = runAnalyze("CLAUDE.md", SAMPLE_CONFIG);
    expect(result.score.categories.clarity).toBeDefined();
    expect(result.score.categories.structure).toBeDefined();
    expect(result.score.categories.tokenEfficiency).toBeDefined();
    expect(result.score.categories.coverage).toBeDefined();
  });

  it("includes platformInfo with sensitivity and model", () => {
    const result = runAnalyze("CLAUDE.md", SAMPLE_CONFIG);
    expect(result.platformInfo.displayName).toBe("Claude Code");
    expect(result.platformInfo.vaguenessSensitivity).toBe(1.0);
    expect(result.platformInfo.subscriptionBased).toBe(false);
  });

  it("cursor platform has higher sensitivity than claude", () => {
    const claude = runAnalyze("CLAUDE.md", VAGUE_CONFIG);
    const cursor = runAnalyze(".cursorrules", VAGUE_CONFIG);
    expect(cursor.platformInfo.vaguenessSensitivity).toBeGreaterThan(
      claude.platformInfo.vaguenessSensitivity
    );
  });

  it("returns null cost for subscription-based platforms", () => {
    const result = runAnalyze("copilot-instructions.md", SAMPLE_CONFIG);
    expect(result.estimatedCostUsd).toBeNull();
    expect(result.platformInfo.subscriptionBased).toBe(true);
  });

  it("returns numeric cost for pay-per-token platforms", () => {
    const result = runAnalyze("CLAUDE.md", SAMPLE_CONFIG);
    expect(typeof result.estimatedCostUsd).toBe("number");
    expect(result.estimatedCostUsd).toBeGreaterThanOrEqual(0);
  });
});

describe("optimize_config pipeline", () => {
  it("returns optimized content and changes summary", () => {
    const result = runOptimize("CLAUDE.md", VAGUE_CONFIG);
    expect(typeof result.optimizedContent).toBe("string");
    expect(Array.isArray(result.changesSummary)).toBe(true);
  });

  it("optimized content differs from vague input", () => {
    const result = runOptimize("CLAUDE.md", VAGUE_CONFIG);
    expect(result.optimizedContent).not.toBe(VAGUE_CONFIG);
  });

  it("includes before and after scores", () => {
    const result = runOptimize("CLAUDE.md", VAGUE_CONFIG);
    expect(result.before.overall).toBeGreaterThanOrEqual(0);
    expect(result.after.overall).toBeGreaterThanOrEqual(0);
    expect(["A", "B", "C", "D", "F"]).toContain(result.before.grade);
    expect(["A", "B", "C", "D", "F"]).toContain(result.after.grade);
  });

  it("scoreDelta is non-negative for vague input", () => {
    const result = runOptimize("CLAUDE.md", VAGUE_CONFIG);
    expect(result.scoreDelta).toBeGreaterThanOrEqual(0);
  });

  it("includes platformInfo in optimize output", () => {
    const result = runOptimize(".cursorrules", VAGUE_CONFIG);
    expect(result.platformInfo.displayName).toBe("Cursor");
    expect(result.platformInfo.vaguenessSensitivity).toBe(1.2);
  });
});

describe("file I/O (plugin behavior)", () => {
  it("reads CLAUDE.md from disk and analyzes it", async () => {
    const { readFile } = await import("fs/promises");
    const { basename } = await import("path");
    const content = await readFile(sampleFile, "utf-8");
    const result = runAnalyze(basename(sampleFile), content);
    expect(result.platform).toBe("claude");
    expect(result.score.overall).toBeGreaterThan(0);
  });

  it("reads .cursorrules from disk and analyzes it", async () => {
    const { readFile } = await import("fs/promises");
    const { basename } = await import("path");
    const content = await readFile(vagueFile, "utf-8");
    const result = runAnalyze(basename(vagueFile), content);
    expect(result.platform).toBe("cursor");
  });

  it("writes optimized content back to disk", async () => {
    const { readFile, writeFile: wf } = await import("fs/promises");
    const content = await readFile(vagueFile, "utf-8");
    const result = runOptimize(".cursorrules", content);
    const outFile = resolve(tmpDir, "optimized.cursorrules");
    await wf(outFile, result.optimizedContent, "utf-8");
    const written = await readFile(outFile, "utf-8");
    expect(written).toBe(result.optimizedContent);
  });
});

describe("scan_project behavior", () => {
  it("identifies known config files in a directory", async () => {
    const { readdir } = await import("fs/promises");
    const ROOT_KNOWN = new Set([
      "claude.md", "claude.local.md", ".cursorrules", "cursor.md",
      ".clinerules", "cline.md", "codex.md", "agents.md", "gemini.md",
      "copilot-instructions.md", ".windsurfrules", "windsurf.md",
      "opencode.md", "kimi.md", "firebender.xml",
    ]);

    const entries = await readdir(tmpDir, { withFileTypes: true });
    const found = entries
      .filter((e) => e.isFile() && ROOT_KNOWN.has(e.name.toLowerCase()))
      .map((e) => e.name);

    expect(found).toContain("CLAUDE.md");
    expect(found).toContain(".cursorrules");
  });

  it("scan finds platform for each discovered file", () => {
    const cases: Array<[string, string]> = [
      ["CLAUDE.md",               "claude"],
      [".cursorrules",             "cursor"],
      ["codex.md",                 "codex"],
      ["gemini.md",                "gemini"],
      ["copilot-instructions.md",  "copilot"],
      ["opencode.md",              "opencode"],
      ["kimi.md",                  "kimi"],
    ];

    for (const [filename, expectedPlatform] of cases) {
      const cfg = parseConfig(filename, "");
      expect(cfg.platform).toBe(expectedPlatform);
    }
  });
});
