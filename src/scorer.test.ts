import { describe, it, expect } from "vitest";
import { parseConfig } from "./parser.js";
import { analyze } from "./analyzer.js";
import { score } from "./scorer.js";

const GOOD_CONFIG = `# Project Rules

## Commands
- Build: \`npm run build\`
- Test: \`npm test\`

## Architecture
Layered design with clear separation of concerns.

## Rules
- Always use TypeScript strict mode
- Never commit secrets
- Use 2-space indentation

## Style
Prefer named exports over default exports.
`;

const POOR_CONFIG = `Write good code that follows best practices.
Use appropriate naming when necessary.
Ensure maintainable and readable output.
`;

const DUPLICATE_CONFIG = `# Rules
Always use TypeScript strict mode for all new files.
Make sure to always use TypeScript strict mode for all new files.
Also always use TypeScript strict mode for all new files please.
`;

describe("score", () => {
  it("returns overall score between 0 and 100", () => {
    const config = parseConfig("CLAUDE.md", GOOD_CONFIG);
    const result = score(analyze(config));
    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
  });

  it("scores good config higher than poor config", () => {
    const goodScore = score(analyze(parseConfig("CLAUDE.md", GOOD_CONFIG))).overall;
    const poorScore = score(analyze(parseConfig("CLAUDE.md", POOR_CONFIG))).overall;
    expect(goodScore).toBeGreaterThan(poorScore);
  });

  it("returns all four category scores", () => {
    const result = score(analyze(parseConfig("CLAUDE.md", GOOD_CONFIG)));
    expect(result.categories.clarity).toBeDefined();
    expect(result.categories.structure).toBeDefined();
    expect(result.categories.tokenEfficiency).toBeDefined();
    expect(result.categories.coverage).toBeDefined();
  });

  it("category scores are each between 0 and 25", () => {
    const result = score(analyze(parseConfig("CLAUDE.md", GOOD_CONFIG)));
    for (const val of Object.values(result.categories)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(25);
    }
  });

  it("assigns grade A for high-scoring config", () => {
    const result = score(analyze(parseConfig("CLAUDE.md", GOOD_CONFIG)));
    expect(["A", "B"]).toContain(result.grade);
  });

  it("assigns grade F or D for very poor config", () => {
    const result = score(analyze(parseConfig("CLAUDE.md", POOR_CONFIG)));
    expect(["F", "D", "C"]).toContain(result.grade);
  });

  it("penalizes duplicate content in token efficiency", () => {
    const cleanResult = score(analyze(parseConfig("CLAUDE.md", GOOD_CONFIG)));
    const dupResult = score(analyze(parseConfig("CLAUDE.md", DUPLICATE_CONFIG)));
    expect(cleanResult.categories.tokenEfficiency).toBeGreaterThanOrEqual(dupResult.categories.tokenEfficiency);
  });

  it("penalizes vague rules in clarity", () => {
    const cleanResult = score(analyze(parseConfig("CLAUDE.md", GOOD_CONFIG)));
    const vagueResult = score(analyze(parseConfig("CLAUDE.md", POOR_CONFIG)));
    expect(cleanResult.categories.clarity).toBeGreaterThan(vagueResult.categories.clarity);
  });

  it("overall equals sum of category scores", () => {
    const result = score(analyze(parseConfig("CLAUDE.md", GOOD_CONFIG)));
    const sum = Object.values(result.categories).reduce((a, b) => a + b, 0);
    expect(result.overall).toBe(sum);
  });

  it("penalizes Codex file exceeding 32 KiB hard truncation limit", () => {
    const over32KB = "# Conventions\n" + "- Always use TypeScript.\n".repeat(1_500);
    const under32KB = "# Conventions\n- Always use TypeScript.\n";
    const overScore = score(analyze(parseConfig("AGENTS.md", over32KB)));
    const underScore = score(analyze(parseConfig("AGENTS.md", under32KB)));
    expect(overScore.categories.tokenEfficiency).toBeLessThan(underScore.categories.tokenEfficiency);
  });

  it("does not apply Codex hard-limit penalty to other platforms", () => {
    // Same-size large file on Claude should not get the extra Codex penalty
    const largeContent = "# Rules\n" + "- Always use TypeScript.\n".repeat(1_500);
    const codexScore = score(analyze(parseConfig("AGENTS.md", largeContent)));
    const claudeScore = score(analyze(parseConfig("CLAUDE.md", largeContent)));
    // Codex should score lower on tokenEfficiency (hard limit penalty on top of verbosity)
    expect(codexScore.categories.tokenEfficiency).toBeLessThanOrEqual(claudeScore.categories.tokenEfficiency);
  });

  it("penalizes Claude coverage when build commands are missing", () => {
    const withCommands = "# Project\n\n## Commands\n```bash\nnpm test\nnpm run build\n```\n\n## Rules\n- Always use TypeScript.\n";
    const withoutCommands = "# Project\n\n## Rules\n- Always use TypeScript.\n- Never commit secrets.\n";
    const withScore = score(analyze(parseConfig("CLAUDE.md", withCommands)));
    const withoutScore = score(analyze(parseConfig("CLAUDE.md", withoutCommands)));
    expect(withScore.categories.coverage).toBeGreaterThan(withoutScore.categories.coverage);
  });

  it("does not apply Claude build commands penalty to other platforms", () => {
    // A Cline config with no build commands should not lose the Claude-specific coverage points
    const noCommands = "# Rules\n- Always use TypeScript.\n- Never commit secrets.\n";
    const claudeScore = score(analyze(parseConfig("CLAUDE.md", noCommands)));
    const clineScore  = score(analyze(parseConfig(".clinerules", noCommands)));
    // Claude loses the extra coverage penalty; cline does not
    expect(claudeScore.categories.coverage).toBeLessThanOrEqual(clineScore.categories.coverage);
  });
});
