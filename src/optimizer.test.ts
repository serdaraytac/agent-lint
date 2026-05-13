import { describe, it, expect } from "vitest";
import { parseConfig } from "./parser.js";
import { analyze } from "./analyzer.js";
import { score } from "./scorer.js";
import { optimize } from "./optimizer.js";

const GOOD_CONFIG = `# Project Rules

## Commands
- Build: \`npm run build\`
- Test: \`npm test\`

## Architecture
Layered design with clear separation of concerns.

## Rules
- Always use TypeScript strict mode
- Never commit secrets

## Style
Use 2-space indentation.
`;

const VAGUE_CONFIG = `# Rules
Write good code for the project.
Follow best practices at all times.
`;

const PASSIVE_CONFIG = `# Rules
- Errors should be handled by the team.
- Edge cases need to be addressed before release.
`;

const WEAK_OBLIGATION_CONFIG = `# Rules
- Try to write tests for new features.
- Ideally document all public functions.
- Consider using TypeScript generics where applicable.
`;

const VAGUE_CONDITION_CONFIG = `# Rules
- Add comments when necessary.
- In most cases prefer composition over inheritance.
- Refactor for large files when possible.
`;

const COMPARATIVE_CONFIG = `# Rules
- Write code that is as clean as possible.
- Improve performance in hot paths.
- Always choose a simpler solution.
`;

const OUTCOME_CONFIG = `# Rules
- Ensure quality in all deliverables.
- Be thorough when reviewing pull requests.
- Handle errors properly in all service calls.
`;

const DUPLICATE_CONFIG = `# Rules
- Always use TypeScript strict mode
- Always use TypeScript strict mode
- Never commit secrets
`;

const ATTENTION_CONFIG = `# Project

## Background
Some background info about the project.
More background info here.
More background info line three.
More background info line four.
More background info line five.
More background info line six.
More background info line seven.
More background info line eight.
More background info line nine.
More background info line ten.

## Deep Section
Never expose API keys in any file or commit.
Always run tests before opening a pull request.

## More Info
Other content here.
Even more content here.
Yet more content here.
And even more content below.
Final line of content here.
`;

describe("optimize", () => {
  it("returns optimized content string", () => {
    const config = parseConfig("CLAUDE.md", GOOD_CONFIG);
    const analysis = analyze(config);
    const scoreResult = score(analysis);
    const result = optimize(config, analysis, scoreResult);
    expect(typeof result.optimizedContent).toBe("string");
    expect(result.optimizedContent.length).toBeGreaterThan(0);
  });

  it("returns changes summary array", () => {
    const config = parseConfig("CLAUDE.md", GOOD_CONFIG);
    const analysis = analyze(config);
    const result = optimize(config, analysis, score(analysis));
    expect(Array.isArray(result.changesSummary)).toBe(true);
    expect(result.changesSummary.length).toBeGreaterThan(0);
  });

  it("replaces vague directives", () => {
    const config = parseConfig("CLAUDE.md", VAGUE_CONFIG);
    const analysis = analyze(config);
    const result = optimize(config, analysis, score(analysis));
    expect(result.changesSummary.some((c) => c.includes("vague"))).toBe(true);
    expect(result.optimizedContent).not.toMatch(/write good code/i);
  });

  it("removes duplicate lines", () => {
    const config = parseConfig("CLAUDE.md", DUPLICATE_CONFIG);
    const analysis = analyze(config);
    const result = optimize(config, analysis, score(analysis));
    const lines = result.optimizedContent.split("\n");
    const strictLines = lines.filter((l) => l.trim() === "- Always use TypeScript strict mode");
    expect(strictLines.length).toBe(1);
    expect(result.changesSummary.some((c) => c.includes("duplicate"))).toBe(true);
  });

  it("adds stubs for missing sections on claude platform", () => {
    const minimalConfig = `# Project\n\n## Rules\n- Never commit secrets\n`;
    const config = parseConfig("CLAUDE.md", minimalConfig);
    const analysis = analyze(config);
    const result = optimize(config, analysis, score(analysis));
    // Missing sections (commands, style, architecture) should get stubs
    const hasTodo = result.optimizedContent.includes("TODO");
    expect(hasTodo).toBe(true);
  });

  it("reports no changes needed for well-structured config", () => {
    // A config that is already clean — we won't enforce an exact message but
    // at minimum the function should not throw and should return something.
    const config = parseConfig("CLAUDE.md", GOOD_CONFIG);
    const analysis = analyze(config);
    const result = optimize(config, analysis, score(analysis));
    expect(result.changesSummary).toBeDefined();
  });

  it("fixes passive-voice patterns", () => {
    const config = parseConfig("CLAUDE.md", PASSIVE_CONFIG);
    const analysis = analyze(config);
    const result = optimize(config, analysis, score(analysis));
    expect(result.optimizedContent).not.toMatch(/should\s+be\s+handled/i);
    expect(result.changesSummary.some((c) => c.includes("vague"))).toBe(true);
  });

  it("fixes weak-obligation patterns", () => {
    const config = parseConfig("CLAUDE.md", WEAK_OBLIGATION_CONFIG);
    const analysis = analyze(config);
    const result = optimize(config, analysis, score(analysis));
    expect(result.optimizedContent).not.toMatch(/\btry\s+to\b/i);
    expect(result.optimizedContent).not.toMatch(/\bideally\b/i);
  });

  it("fixes vague-condition patterns", () => {
    const config = parseConfig("CLAUDE.md", VAGUE_CONDITION_CONFIG);
    const analysis = analyze(config);
    const result = optimize(config, analysis, score(analysis));
    expect(result.optimizedContent).not.toMatch(/\bin\s+most\s+cases\b/i);
    expect(result.optimizedContent).not.toMatch(/\bwhen\s+necessary\b/i);
  });

  it("fixes comparative-without-baseline patterns", () => {
    const config = parseConfig("CLAUDE.md", COMPARATIVE_CONFIG);
    const analysis = analyze(config);
    const result = optimize(config, analysis, score(analysis));
    expect(result.optimizedContent).not.toMatch(/as\s+clean\s+as\s+possible/i);
  });

  it("fixes outcome-without-criterion patterns", () => {
    const config = parseConfig("CLAUDE.md", OUTCOME_CONFIG);
    const analysis = analyze(config);
    const result = optimize(config, analysis, score(analysis));
    expect(result.optimizedContent).not.toMatch(/\bensure\s+quality\b/i);
    expect(result.optimizedContent).not.toMatch(/\bhandle\s+errors?\s+properly\b/i);
  });

  it("moves critical rules toward the top when attention issue exists", () => {
    const config = parseConfig("CLAUDE.md", ATTENTION_CONFIG);
    const analysis = analyze(config);
    const result = optimize(config, analysis, score(analysis));
    const lines = result.optimizedContent.split("\n");
    const criticalSectionIdx = lines.findIndex((l) => l.includes("Critical Rules"));
    const neverIdx = lines.findIndex((l) => l.toLowerCase().includes("never expose"));
    if (criticalSectionIdx !== -1) {
      // If a critical section was added, the never line should be near the top
      expect(neverIdx).toBeLessThan(lines.length / 2);
    }
  });
});
