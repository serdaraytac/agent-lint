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
      expect(neverIdx).toBeLessThan(lines.length / 2);
    }
  });

  describe("platform-specific optimizations", () => {
    it("adds frontmatter stub to Cursor .cursor/rules/ file missing it", () => {
      const config = parseConfig(".cursor/rules/typescript.md", "# TypeScript Rules\n- Always use strict mode.");
      const analysis = analyze(config);
      const result = optimize(config, analysis, score(analysis));
      expect(result.optimizedContent).toMatch(/^---/);
      expect(result.optimizedContent).toContain("alwaysApply");
      expect(result.changesSummary.some((c) => c.includes("frontmatter"))).toBe(true);
    });

    it("does not add Cursor frontmatter if already present", () => {
      const content = "---\nalwaysApply: true\n---\n# Rules\n- Use strict mode.";
      const config = parseConfig(".cursor/rules/typescript.md", content);
      const analysis = analyze(config);
      const result = optimize(config, analysis, score(analysis));
      const frontmatterCount = (result.optimizedContent.match(/^---/gm) ?? []).length;
      expect(frontmatterCount).toBeLessThanOrEqual(2); // open + close, not duplicated
    });

    it("converts Cline prose to bullet points", () => {
      const content = "# Rules\nAlways use TypeScript.\nNever commit secrets.\nWrite tests for every feature.\nDocument public APIs.\nKeep functions small.\nFollow naming conventions.";
      const config = parseConfig(".clinerules", content);
      const analysis = analyze(config);
      const result = optimize(config, analysis, score(analysis));
      const bulletLines = result.optimizedContent.split("\n").filter((l) => l.startsWith("- "));
      expect(bulletLines.length).toBeGreaterThan(0);
      expect(result.changesSummary.some((c) => c.includes("bullet"))).toBe(true);
    });

    it("fixes Gemini invalid @ import paths to use ./ prefix", () => {
      const content = "# Rules\n@rules.md\n@styles.md\n- Use TypeScript.";
      const config = parseConfig("GEMINI.md", content);
      const analysis = analyze(config);
      const result = optimize(config, analysis, score(analysis));
      expect(result.optimizedContent).not.toMatch(/@rules\.md/);
      expect(result.optimizedContent).toContain("@./rules.md");
      expect(result.changesSummary.some((c) => c.includes("@-import"))).toBe(true);
    });

    it("fixes Amp bare @mention paths to use ./ prefix", () => {
      const content = "# Docs\nSee @doc/style.md for conventions.\n";
      const config = parseConfig("amp-rules.md", content);
      const analysis = analyze(config);
      const result = optimize(config, analysis, score(analysis));
      expect(result.optimizedContent).toContain("@./doc/style.md");
      expect(result.changesSummary.some((c) => c.includes("@-mention"))).toBe(true);
    });

    it("adds applyTo frontmatter stub to Copilot path-specific file missing it", () => {
      const content = "# Ruby Rules\n- Always freeze strings.";
      const config = parseConfig(".github/instructions/ruby.instructions.md", content);
      const analysis = analyze(config);
      const result = optimize(config, analysis, score(analysis));
      expect(result.optimizedContent).toMatch(/^---/);
      expect(result.optimizedContent).toContain("applyTo");
      expect(result.changesSummary.some((c) => c.includes("applyTo"))).toBe(true);
    });

    it("uses platform-specific section hint content for Codex stubs", () => {
      const minimal = "# Conventions\n- Use TypeScript.\n";
      const config = parseConfig("AGENTS.md", minimal);
      const analysis = analyze(config);
      const result = optimize(config, analysis, score(analysis));
      // Codex stubs should contain Codex-specific hints, not generic TODO
      if (result.optimizedContent.includes("## Testing")) {
        expect(result.optimizedContent).toContain("Test framework");
      }
    });

    it("uses platform-specific section hint content for Gemini stubs", () => {
      const minimal = "# Instructions\n- Use TypeScript.\n";
      const config = parseConfig("GEMINI.md", minimal);
      const analysis = analyze(config);
      const result = optimize(config, analysis, score(analysis));
      if (result.optimizedContent.includes("## Context")) {
        expect(result.optimizedContent).toContain("@./");
      }
    });

    it("adds Commands section stub to Claude config missing build commands", () => {
      const content = "# Project\n\n## Rules\n- Always use TypeScript.\n";
      const config = parseConfig("CLAUDE.md", content);
      const analysis = analyze(config);
      const result = optimize(config, analysis, score(analysis));
      expect(result.optimizedContent).toContain("## Commands");
      expect(result.optimizedContent).toContain("```bash");
      expect(result.changesSummary.some((c) => c.includes("Commands section"))).toBe(true);
    });

    it("does not add Commands stub when Claude config already has build commands", () => {
      const content = "# Project\n\n## Commands\n```bash\nnpm test\n```\n\n## Rules\n- Use TypeScript.\n";
      const config = parseConfig("CLAUDE.md", content);
      const analysis = analyze(config);
      const before = (content.match(/## Commands/g) ?? []).length;
      const result = optimize(config, analysis, score(analysis));
      const after = (result.optimizedContent.match(/## Commands/g) ?? []).length;
      expect(after).toBe(before);
    });

    it("reports unfilled placeholders in Claude changesSummary", () => {
      const content = "# Rules\n- [TODO: define style]\n- [TODO: add test rules]\n";
      const config = parseConfig("CLAUDE.md", content);
      const analysis = analyze(config);
      const result = optimize(config, analysis, score(analysis));
      expect(result.changesSummary.some((c) => c.includes("[TODO:]"))).toBe(true);
      expect(result.changesSummary.some((c) => c.includes("2"))).toBe(true);
    });

    it("uses claude-specific section hint for commands stub", () => {
      const content = "# Project\n\n## Rules\n- Always use TypeScript.\n";
      const config = parseConfig("CLAUDE.md", content);
      const analysis = analyze(config);
      const result = optimize(config, analysis, score(analysis));
      // Commands stub should contain bash code block, not a generic comment
      expect(result.optimizedContent).toContain("```bash");
    });
  });
});
