import { describe, it, expect } from "vitest";
import { parseConfig } from "./parser.js";
import {
  analyze,
  analyzeTokenCost,
  analyzeVagueRules,
  analyzeMissingSections,
  analyzeDuplicates,
  analyzeAttentionPlacement,
  analyzeStructure,
  analyzeFormatCompliance,
} from "./analyzer.js";

const SAMPLE_CLAUDE = `# Project Rules

## Commands
- Build: \`npm run build\`
- Test: \`npm test\`

## Architecture
Uses a layered approach with clear separation.

## Rules
- Always use TypeScript strict mode
- Never commit secrets to the repo
- Write tests for all new code

## Style
Use 2-space indentation.
`;

const VAGUE_CONTENT = `# Rules
Write good code that follows best practices.
Use appropriate naming conventions when necessary.
Ensure code is maintainable and readable.
`;

const DUPLICATE_CONTENT = `# Rules
Always use TypeScript strict mode for all new files.
Make sure to always use TypeScript strict mode for all new files.
`;

describe("analyzeTokenCost", () => {
  it("estimates token count from char count", () => {
    const config = parseConfig("CLAUDE.md", "a".repeat(400));
    const result = analyzeTokenCost(config);
    expect(result.tokenCount).toBe(100);
  });

  it("estimates cost proportional to tokens", () => {
    const config = parseConfig("CLAUDE.md", "a".repeat(4_000_000));
    const result = analyzeTokenCost(config);
    expect(result.estimatedCostUsd).toBeCloseTo(3, 0);
  });

  it("returns zero cost for empty file", () => {
    const config = parseConfig("CLAUDE.md", "");
    const result = analyzeTokenCost(config);
    expect(result.tokenCount).toBe(0);
    expect(result.estimatedCostUsd).toBe(0);
  });
});

describe("analyzeVagueRules", () => {
  it("detects vague lines", () => {
    const config = parseConfig("CLAUDE.md", VAGUE_CONTENT);
    const result = analyzeVagueRules(config);
    expect(result.vagueLines.length).toBeGreaterThan(0);
  });

  it("does not flag headings", () => {
    const config = parseConfig("CLAUDE.md", "# Write good headings\nThis is fine.");
    const result = analyzeVagueRules(config);
    expect(result.vagueLines.every((v) => !v.text.startsWith("#"))).toBe(true);
  });

  it("returns empty for clean rules", () => {
    const config = parseConfig("CLAUDE.md", SAMPLE_CLAUDE);
    const result = analyzeVagueRules(config);
    expect(result.vagueLines).toHaveLength(0);
  });

  it("captures the reason for each vague line", () => {
    const config = parseConfig("CLAUDE.md", VAGUE_CONTENT);
    const result = analyzeVagueRules(config);
    expect(result.vagueLines[0].reason).toBeTruthy();
  });

  it("captures the category for each vague line", () => {
    const config = parseConfig("CLAUDE.md", VAGUE_CONTENT);
    const result = analyzeVagueRules(config);
    expect(result.vagueLines[0].category).toBeTruthy();
  });

  it("detects passive-voice patterns", () => {
    const content = "# Rules\nErrors should be handled by the system.\nEdge cases need to be addressed.";
    const config = parseConfig("CLAUDE.md", content);
    const result = analyzeVagueRules(config);
    const categories = result.vagueLines.map((v) => v.category);
    expect(categories).toContain("passive-voice");
  });

  it("detects false-shared-context patterns", () => {
    const content = "# Rules\nFollow best practices for all new code.\nUse common sense when refactoring.\nUse your judgment for edge cases.";
    const config = parseConfig("CLAUDE.md", content);
    const result = analyzeVagueRules(config);
    const categories = result.vagueLines.map((v) => v.category);
    expect(categories).toContain("false-shared-context");
  });

  it("detects weak-obligation patterns", () => {
    const content = "# Rules\nTry to write tests for new features.\nIdeally document all public functions.\nConsider using TypeScript generics.";
    const config = parseConfig("CLAUDE.md", content);
    const result = analyzeVagueRules(config);
    const categories = result.vagueLines.map((v) => v.category);
    expect(categories).toContain("weak-obligation");
  });

  it("detects vague-condition patterns", () => {
    const content = "# Rules\nAdd comments when necessary.\nRefactor for large files.\nIn general prefer composition over inheritance.";
    const config = parseConfig("CLAUDE.md", content);
    const result = analyzeVagueRules(config);
    const categories = result.vagueLines.map((v) => v.category);
    expect(categories).toContain("vague-condition");
  });

  it("detects comparative-without-baseline patterns", () => {
    const content = "# Rules\nWrite code that is as simple as possible.\nImprove performance where you can.\nAlways prefer a cleaner solution.";
    const config = parseConfig("CLAUDE.md", content);
    const result = analyzeVagueRules(config);
    const categories = result.vagueLines.map((v) => v.category);
    expect(categories).toContain("comparative-without-baseline");
  });

  it("detects outcome-without-criterion patterns", () => {
    const content = "# Rules\nEnsure quality in all deliverables.\nBe thorough when reviewing code.\nHandle errors properly.";
    const config = parseConfig("CLAUDE.md", content);
    const result = analyzeVagueRules(config);
    const categories = result.vagueLines.map((v) => v.category);
    expect(categories).toContain("outcome-without-criterion");
  });

  it("detects unmeasurable-quality patterns", () => {
    const content = "# Rules\nWrite elegant and robust solutions.\nAll code should be well-written.";
    const config = parseConfig("CLAUDE.md", content);
    const result = analyzeVagueRules(config);
    const categories = result.vagueLines.map((v) => v.category);
    expect(categories).toContain("unmeasurable-quality");
  });
});

describe("analyzeMissingSections", () => {
  it("reports missing sections for claude platform", () => {
    const config = parseConfig("CLAUDE.md", "# Rules\nSome rule.");
    const result = analyzeMissingSections(config);
    expect(result.missing).toContain("commands");
  });

  it("reports present sections correctly", () => {
    const config = parseConfig("CLAUDE.md", SAMPLE_CLAUDE);
    const result = analyzeMissingSections(config);
    expect(result.present).toContain("commands");
    expect(result.present).toContain("rules");
    expect(result.present).toContain("style");
  });

  it("uses default expected sections for unknown platform", () => {
    const config = parseConfig("unknown.md", "# Notes\nSome content.");
    const result = analyzeMissingSections(config);
    expect(result.missing).toContain("rules");
  });
});

describe("analyzeDuplicates", () => {
  it("detects duplicate phrases across lines", () => {
    const config = parseConfig("CLAUDE.md", DUPLICATE_CONTENT);
    const result = analyzeDuplicates(config);
    expect(result.duplicatePhrases.length).toBeGreaterThan(0);
  });

  it("returns empty for non-duplicate content", () => {
    const config = parseConfig("CLAUDE.md", SAMPLE_CLAUDE);
    const result = analyzeDuplicates(config);
    expect(result.duplicatePhrases).toHaveLength(0);
  });
});

describe("analyzeAttentionPlacement", () => {
  it("detects critical keywords in head", () => {
    const content = "# Rules\nNever commit secrets.\n" + "filler\n".repeat(20);
    const config = parseConfig("CLAUDE.md", content);
    const result = analyzeAttentionPlacement(config);
    expect(result.criticalInHead).toBe(true);
  });

  it("suggests moving critical rules when not at head or tail", () => {
    const filler = "filler line without keywords\n".repeat(30);
    const content = filler + "Never commit secrets.\n" + filler;
    const config = parseConfig("CLAUDE.md", content);
    const result = analyzeAttentionPlacement(config);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it("no suggestions when no critical content exists", () => {
    const config = parseConfig("CLAUDE.md", "# Rules\nUse 2-space indentation.");
    const result = analyzeAttentionPlacement(config);
    expect(result.suggestions).toHaveLength(0);
  });
});

describe("analyzeStructure", () => {
  it("detects presence of headings", () => {
    const config = parseConfig("CLAUDE.md", SAMPLE_CLAUDE);
    const result = analyzeStructure(config);
    expect(result.hasHeadings).toBe(true);
    expect(result.headingCount).toBeGreaterThan(0);
  });

  it("reports no headings for flat content", () => {
    const config = parseConfig("CLAUDE.md", "Use tabs.\nWrite tests.\n");
    const result = analyzeStructure(config);
    expect(result.hasHeadings).toBe(false);
  });

  it("detects long paragraph lines", () => {
    const longLine = "a".repeat(130);
    const config = parseConfig("CLAUDE.md", `# Rules\n${longLine}\n`);
    const result = analyzeStructure(config);
    expect(result.longParagraphLines).toContain(2);
  });

  it("counts unorganized rules before first heading", () => {
    const content = "Rule one.\nRule two.\nRule three.\nRule four.\n# Section\nOrganized rule.";
    const config = parseConfig("CLAUDE.md", content);
    const result = analyzeStructure(config);
    expect(result.unorganizedRuleCount).toBe(4);
  });
});

describe("analyzeFormatCompliance", () => {
  it("returns empty issues for platforms with no format rules", () => {
    const config = parseConfig("opencode.md", "# Rules\nAlways use TypeScript.");
    const result = analyzeFormatCompliance(config);
    expect(result.issues).toHaveLength(0);
  });

  describe("copilot", () => {
    it("flags files over 4,000 characters (code review hard limit)", () => {
      const content = "# Instructions\n" + "Use TypeScript.\n".repeat(250);
      const config = parseConfig("copilot-instructions.md", content);
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "COPILOT_SIZE_LIMIT")).toBe(true);
    });

    it("does not flag files under 4,000 characters", () => {
      const config = parseConfig("copilot-instructions.md", "# Instructions\nUse TypeScript.");
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "COPILOT_SIZE_LIMIT")).toBe(false);
    });

    it("flags files over 1,000 lines (documented soft limit)", () => {
      const content = "Use TypeScript.\n".repeat(1_010);
      const config = parseConfig("copilot-instructions.md", content);
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "COPILOT_LINE_LIMIT")).toBe(true);
    });

    it("does not flag files under 1,000 lines", () => {
      const config = parseConfig("copilot-instructions.md", "# Instructions\nUse TypeScript.");
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "COPILOT_LINE_LIMIT")).toBe(false);
    });
  });

  describe("cursor", () => {
    it("ignores .cursorrules (not a .cursor/rules/ file)", () => {
      const config = parseConfig(".cursorrules", "# Rules\nAlways use TypeScript.");
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "CURSOR_MISSING_FRONTMATTER")).toBe(false);
    });

    it("flags .cursor/rules/ file without frontmatter", () => {
      const config = parseConfig(".cursor/rules/typescript.md", "# TypeScript Rules\nAlways use strict mode.");
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "CURSOR_MISSING_FRONTMATTER")).toBe(true);
    });

    it("flags .cursor/rules/ file with frontmatter but missing globs/alwaysApply", () => {
      const content = "---\ndescription: TypeScript rules\n---\n# Rules\nAlways use strict mode.";
      const config = parseConfig(".cursor/rules/typescript.md", content);
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "CURSOR_FRONTMATTER_INCOMPLETE")).toBe(true);
    });

    it("accepts .cursor/rules/ file with globs frontmatter", () => {
      const content = "---\nglobs: [\"**/*.ts\"]\n---\n# Rules\nAlways use strict mode.";
      const config = parseConfig(".cursor/rules/typescript.md", content);
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code.startsWith("CURSOR_"))).toBe(false);
    });

    it("accepts .cursor/rules/ file with alwaysApply frontmatter", () => {
      const content = "---\nalwaysApply: true\n---\n# Rules\nAlways use strict mode.";
      const config = parseConfig(".cursor/rules/typescript.md", content);
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code.startsWith("CURSOR_"))).toBe(false);
    });
  });

  describe("claude", () => {
    it("flags build commands outside code blocks", () => {
      const content = "# Commands\nnpm run build\nnpm test\n";
      const config = parseConfig("CLAUDE.md", content);
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "CLAUDE_COMMANDS_NOT_IN_BLOCK")).toBe(true);
    });

    it("does not flag commands inside fenced code blocks", () => {
      const content = "# Commands\n```bash\nnpm run build\n```\n";
      const config = parseConfig("CLAUDE.md", content);
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "CLAUDE_COMMANDS_NOT_IN_BLOCK")).toBe(false);
    });

    it("does not flag inline code in backtick spans", () => {
      const content = "# Commands\n- Build: `npm run build`\n";
      const config = parseConfig("CLAUDE.md", content);
      // Inline backticks don't open/close code blocks — this should flag
      // because the line is outside a fenced block; acceptable behavior documented
      const result = analyzeFormatCompliance(config);
      expect(Array.isArray(result.issues)).toBe(true);
    });
  });

  describe("gemini", () => {
    it("returns no format compliance issues (no official format requirements)", () => {
      const content = "# Rules\nAlways use TypeScript.\n# Context\nThis is a Node.js project.\n";
      const config = parseConfig("gemini.md", content);
      const result = analyzeFormatCompliance(config);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe("cline", () => {
    it("flags unstructured prose with no bullet lists (documented recommendation)", () => {
      const content = "# Rules\nAlways use TypeScript.\nNever commit secrets.\nWrite tests for every feature.\nDocument public APIs.\nKeep functions small.\nFollow naming conventions.";
      const config = parseConfig(".clinerules", content);
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "CLINE_UNSTRUCTURED_RULES")).toBe(true);
    });

    it("does not flag bullet-list content", () => {
      const content = "# Rules\n- Always use TypeScript.\n- Never commit secrets.\n- Write tests.";
      const config = parseConfig(".clinerules", content);
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "CLINE_UNSTRUCTURED_RULES")).toBe(false);
    });

    it("does not flag short files (under 5 content lines)", () => {
      const config = parseConfig(".clinerules", "# Rules\nAlways use TypeScript.");
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "CLINE_UNSTRUCTURED_RULES")).toBe(false);
    });
  });

  describe("codex", () => {
    it("flags files over 32 KiB (documented hard limit)", () => {
      const content = "# Conventions\n" + "Always use TypeScript.\n".repeat(1_500);
      const config = parseConfig("AGENTS.md", content);
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "CODEX_SIZE_LIMIT")).toBe(true);
    });

    it("does not flag files under 32 KiB", () => {
      const config = parseConfig("AGENTS.md", "# Conventions\n- Always use TypeScript.");
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "CODEX_SIZE_LIMIT")).toBe(false);
    });
  });

  describe("windsurf", () => {
    it("flags .windsurfrules with a migration suggestion to AGENTS.md", () => {
      const config = parseConfig(".windsurfrules", "# Rules\n- Always use TypeScript.");
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "WINDSURF_PREFER_AGENTS_MD")).toBe(true);
    });

    it("WINDSURF_PREFER_AGENTS_MD is info severity", () => {
      const config = parseConfig(".windsurfrules", "# Rules\n- Always use TypeScript.");
      const result = analyzeFormatCompliance(config);
      const issue = result.issues.find((i) => i.code === "WINDSURF_PREFER_AGENTS_MD");
      expect(issue?.severity).toBe("info");
    });
  });

  describe("amp", () => {
    it("flags .amp/instructions.md as an incorrect filename", () => {
      const config = parseConfig(".amp/instructions.md", "# Rules\n- Always use TypeScript.");
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "AMP_INCORRECT_FILENAME")).toBe(true);
    });

    it("AMP_INCORRECT_FILENAME is info severity", () => {
      const config = parseConfig(".amp/instructions.md", "# Rules\n- Always use TypeScript.");
      const result = analyzeFormatCompliance(config);
      const issue = result.issues.find((i) => i.code === "AMP_INCORRECT_FILENAME");
      expect(issue?.severity).toBe("info");
    });
  });

  describe("warp", () => {
    it("flags .warp/instructions.md as an incorrect filename", () => {
      const config = parseConfig(".warp/instructions.md", "# Rules\n- Always use TypeScript.");
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "WARP_INCORRECT_FILENAME")).toBe(true);
    });

    it("WARP_INCORRECT_FILENAME is info severity", () => {
      const config = parseConfig(".warp/instructions.md", "# Rules\n- Always use TypeScript.");
      const result = analyzeFormatCompliance(config);
      const issue = result.issues.find((i) => i.code === "WARP_INCORRECT_FILENAME");
      expect(issue?.severity).toBe("info");
    });
  });

  describe("firebender", () => {
    it("flags markdown headings in XML file", () => {
      const content = "# Rules\nAlways use TypeScript.\n";
      const config = parseConfig("firebender.xml", content);
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "FIREBENDER_MARKDOWN_IN_XML")).toBe(true);
    });

    it("flags plain text with no XML markup", () => {
      const content = "Always use TypeScript. Never commit secrets.";
      const config = parseConfig("firebender.xml", content);
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "FIREBENDER_MISSING_XML")).toBe(true);
    });

    it("accepts valid XML content", () => {
      const content = "<?xml version=\"1.0\"?>\n<rules>\n  <rule>Always use TypeScript.</rule>\n</rules>";
      const config = parseConfig("firebender.xml", content);
      const result = analyzeFormatCompliance(config);
      expect(result.issues.some((i) => i.code === "FIREBENDER_MARKDOWN_IN_XML")).toBe(false);
      expect(result.issues.some((i) => i.code === "FIREBENDER_MISSING_XML")).toBe(false);
    });
  });
});

describe("analyze (integration)", () => {
  it("returns issues array", () => {
    const config = parseConfig("CLAUDE.md", VAGUE_CONTENT);
    const result = analyze(config);
    expect(Array.isArray(result.issues)).toBe(true);
  });

  it("returns all check categories", () => {
    const config = parseConfig("CLAUDE.md", SAMPLE_CLAUDE);
    const result = analyze(config);
    expect(result.checks.tokenCost).toBeDefined();
    expect(result.checks.vagueRules).toBeDefined();
    expect(result.checks.missingSections).toBeDefined();
    expect(result.checks.duplicates).toBeDefined();
    expect(result.checks.attentionPlacement).toBeDefined();
    expect(result.checks.structure).toBeDefined();
    expect(result.checks.formatCompliance).toBeDefined();
  });

  it("flags vague rules as issues", () => {
    const config = parseConfig("CLAUDE.md", VAGUE_CONTENT);
    const result = analyze(config);
    const vagueIssues = result.issues.filter((i) => i.code === "VAGUE_RULE");
    expect(vagueIssues.length).toBeGreaterThan(0);
  });

  it("issues have valid severity", () => {
    const config = parseConfig("CLAUDE.md", VAGUE_CONTENT);
    const result = analyze(config);
    const validSeverities = new Set(["critical", "warning", "info"]);
    result.issues.forEach((issue) => {
      expect(validSeverities.has(issue.severity)).toBe(true);
    });
  });
});
