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
});
