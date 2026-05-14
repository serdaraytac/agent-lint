import type { ParsedConfig } from "./parser.js";
import type { AnalysisResult, Issue } from "./analyzer.js";
import type { ScoreResult } from "./scorer.js";

export interface OptimizationResult {
  optimizedContent: string;
  changesSummary: string[];
}

// Maps vague phrases to concrete alternatives, organized by category.
// Patterns mirror the VAGUE_PATTERNS in analyzer.ts.
// Replacements with $1/$2 use JavaScript's native capture-group substitution.
const VAGUE_REPLACEMENTS: Array<{ pattern: RegExp; suggestion: string }> = [
  // --- unmeasurable-quality ---
  { pattern: /\bwrite\s+(good|great|better|clean|quality|nice)\s+code\b/gi, suggestion: "write code that passes all tests and type checks" },
  { pattern: /\b(elegant|robust)\b/gi, suggestion: "[TODO: replace with a measurable criterion]" },
  { pattern: /\bwell[\s-]?(written|structured|organized)\b/gi, suggestion: "[TODO: specify the convention, e.g. follows linting rules, passes type checks]" },
  { pattern: /\bhigh[\s-]?quality\b/gi, suggestion: "verified via tests and linting" },
  { pattern: /\bmaintainable\b/gi, suggestion: "easy to extend without modifying existing functions" },
  { pattern: /\breadable\b/gi, suggestion: "self-documenting through naming, not comments" },
  { pattern: /\bproper(ly)?\b/gi, suggestion: "[TODO: define what correct means in this context]" },

  // --- false-shared-context ---
  { pattern: /\bfollow\s+best\s+practices\b/gi, suggestion: "follow the conventions defined in this file" },
  { pattern: /\buse\s+common\s+sense\b/gi, suggestion: "[TODO: define the decision criteria explicitly]" },
  { pattern: /\buse\s+(your\s+)?judgment\b/gi, suggestion: "[TODO: specify the decision criteria]" },
  { pattern: /\buse\s+standard\s+patterns?\b/gi, suggestion: "[TODO: name the specific patterns, e.g. repository, factory]" },
  { pattern: /\bindustry\s+standards?\b/gi, suggestion: "[TODO: reference the specific standard or spec]" },
  { pattern: /\bfollow\s+(the\s+)?conventions?\b/gi, suggestion: "follow the conventions defined in this file" },
  { pattern: /\bconventional\s+(approach|way|method)\b/gi, suggestion: "[TODO: describe the expected approach explicitly]" },
  { pattern: /\bstandard\s+(way|approach|practice)\b/gi, suggestion: "[TODO: name the specific practice]" },

  // --- passive-voice ---
  { pattern: /\bshould\s+be\s+(done|handled|implemented|addressed|considered|reviewed|tested)\b/gi, suggestion: "must [TODO: specify who performs this action and how]" },
  { pattern: /\bneeds?\s+to\s+be\s+(handled|done|checked|fixed|resolved|addressed)\b/gi, suggestion: "must [TODO: specify the action and owner]" },
  { pattern: /\bmust\s+be\s+considered\b/gi, suggestion: "must [TODO: specify the required action]" },
  { pattern: /\bis\s+expected\s+to\b/gi, suggestion: "must [TODO: rewrite as an active directive]" },

  // --- weak-obligation ---
  { pattern: /\btry\s+to\b/gi, suggestion: "[TODO: use 'always' if required, or remove if optional]" },
  { pattern: /\battempt\s+to\b/gi, suggestion: "[TODO: use 'must' if required, or remove if optional]" },
  { pattern: /\bconsider\s+(using|adding|implementing|making|doing)\b/gi, suggestion: "[TODO: decide if required — use 'always $1' or remove]" },
  { pattern: /\bmight\s+want\s+to\b/gi, suggestion: "[TODO: use 'must' if required, or remove]" },
  { pattern: /\bit\s+would\s+be\s+(good|nice|helpful|better)\s+to\b/gi, suggestion: "[TODO: rewrite as a directive or remove]" },
  { pattern: /\bideally\b/gi, suggestion: "[TODO: remove qualifier and state the rule directly, or drop if aspirational only]" },

  // --- vague-condition ---
  { pattern: /\bappropriate(ly)?\b/gi, suggestion: "[TODO: define the criterion for appropriateness]" },
  { pattern: /\bas\s+needed\b/gi, suggestion: "when [TODO: specify the trigger condition]" },
  { pattern: /\bwhen\s+(necessary|applicable|possible|appropriate)\b/gi, suggestion: "when [TODO: specify the exact condition]" },
  { pattern: /\bif\s+(necessary|needed|required|applicable)\b/gi, suggestion: "if [TODO: specify the condition]" },
  { pattern: /\bin\s+most\s+cases\b/gi, suggestion: "always, except when [TODO: list the explicit exceptions]" },
  { pattern: /\bin\s+general\b/gi, suggestion: "[TODO: remove qualifier — state the rule directly]" },
  { pattern: /\bwhere\s+(possible|feasible)\b/gi, suggestion: "[TODO: define what makes this impossible, or make it unconditional]" },
  { pattern: /\bfor\s+(large|complex|small)\s+(files?|functions?|classes?|components?)\b/gi, suggestion: "for $2 exceeding [TODO: specify a measurable threshold, e.g. 300 lines]" },

  // --- comparative-without-baseline ---
  { pattern: /\bas\s+(\w+)\s+as\s+possible\b/gi, suggestion: "[TODO: specify a concrete target, e.g. under 50 lines, under 200ms]" },
  { pattern: /\bimprove\s+(performance|readability|maintainability|quality)\b/gi, suggestion: "ensure $1 meets [TODO: specify the threshold or criterion]" },
  { pattern: /\b(better|cleaner|simpler|faster)\s+(code|approach|solution|implementation)\b/gi, suggestion: "$2 that [TODO: define the acceptance baseline]" },
  { pattern: /\befficient(ly)?\s+as\s+possible\b/gi, suggestion: "[TODO: specify the performance target, e.g. p95 latency under 200ms]" },
  { pattern: /\boptimize\s+(for\s+)?(performance|speed|memory|readability)\b/gi, suggestion: "optimize $2 to [TODO: specify the target metric and threshold]" },

  // --- outcome-without-criterion ---
  { pattern: /\bensure\s+(quality|correctness|accuracy|consistency)\b/gi, suggestion: "verify $1 via tests and linting" },
  { pattern: /\bmaintain\s+(standards?|quality|consistency)\b/gi, suggestion: "conform to the rules defined in this file" },
  { pattern: /\bbe\s+(thorough|careful|diligent|mindful|consistent)\b/gi, suggestion: "[TODO: specify what this means concretely — replace with a verifiable check]" },
  { pattern: /\bpay\s+attention\s+to\b/gi, suggestion: "always verify [TODO: specify what to check]" },
  { pattern: /\bhandle\s+(errors?|edge\s+cases?)\s+properly\b/gi, suggestion: "handle $1 by [TODO: specify the strategy, e.g. log and rethrow / return Result type]" },
  { pattern: /\bsimple(r|ly)?\b/gi, suggestion: "[TODO: define simplicity criterion, e.g. cyclomatic complexity ≤ 5]" },
];

function deduplicateLines(lines: string[]): { lines: string[]; removed: number } {
  const seen = new Set<string>();
  const result: string[] = [];
  let removed = 0;

  for (const line of lines) {
    const normalized = line.trim().toLowerCase();
    // Keep empty lines and headings always
    if (!normalized || normalized.startsWith("#")) {
      result.push(line);
      continue;
    }
    if (seen.has(normalized)) {
      removed++;
    } else {
      seen.add(normalized);
      result.push(line);
    }
  }

  return { lines: result, removed };
}

function fixVagueRules(content: string): { content: string; replacements: number } {
  let result = content;
  let replacements = 0;

  for (const { pattern, suggestion } of VAGUE_REPLACEMENTS) {
    const before = result;
    result = result.replace(pattern, suggestion);
    if (result !== before) replacements++;
  }

  return { content: result, replacements };
}

// Platform-specific hints for each expected section — replaces generic TODO comments.
const SECTION_HINTS: Record<string, Record<string, string>> = {
  claude: {
    commands:     "```bash\n# [TODO: build command, e.g. npm run build]\n# [TODO: test command, e.g. npm test]\n# [TODO: lint command, e.g. npm run lint]\n```",
    architecture: "<!-- Key directories, main modules, and design decisions -->",
    rules:        "<!-- Coding conventions and hard requirements for this project -->",
    style:        "<!-- Formatting, naming, and style guide references -->",
  },
  codex: {
    conventions:       "<!-- Naming rules, code style, and working agreements for this repo -->",
    testing:           "<!-- Test framework, coverage requirements, and how to run tests -->",
    architecture:      "<!-- Repository structure, key modules, and design decisions -->",
    "pr-instructions": "<!-- PR title format, review process, and merge criteria -->",
  },
  cursor: {
    rules:             "<!-- Directives that apply to every file Cursor edits -->",
    style:             "<!-- Formatting, naming, and code style conventions -->",
    context:           "<!-- Background the model needs to understand this codebase -->",
  },
  cline: {
    rules:             "<!-- Each rule on its own bullet — be specific, not vague -->",
    context:           "<!-- Project background, stack, and key dependencies -->",
  },
  gemini: {
    instructions:      "<!-- Primary directives — Gemini reads these on every turn -->",
    context:           "<!-- Project overview; use @./context.md to split large sections -->",
    constraints:       "<!-- Hard boundaries: what Gemini must never do -->",
  },
  copilot: {
    instructions:      "<!-- Directives for GitHub Copilot — keep under 4,000 characters for code review -->",
    style:             "<!-- Formatting and naming conventions -->",
  },
  amp: {
    conventions:       "<!-- Coding standards; reference files with @./path/to/guide.md -->",
    testing:           "<!-- Test requirements and how to run the test suite -->",
  },
  opencode: {
    rules:             "<!-- Project rules — AGENTS.md at root; compose extras via opencode.json 'instructions' -->",
  },
};

function addMissingSectionStubs(content: string, missingSections: string[], platform: string): { content: string; added: string[] } {
  if (missingSections.length === 0) return { content, added: [] };

  const platformHints = SECTION_HINTS[platform] ?? {};
  const stubs: string[] = [];
  const added: string[] = [];

  for (const section of missingSections) {
    const capitalized = section.charAt(0).toUpperCase() + section.slice(1);
    const hint = platformHints[section] ?? `<!-- TODO: Add ${section} guidance -->`;
    stubs.push(`\n## ${capitalized}\n${hint}`);
    added.push(section);
  }

  return { content: content + stubs.join("\n"), added };
}

// Converts non-heading, non-bullet prose lines to bullet list format.
// Used for Cline where docs explicitly recommend "bullet points make individual requirements clear".
function proseTooBullets(lines: string[]): { lines: string[]; converted: number } {
  let converted = 0;
  let insideBlock = false;
  const result = lines.map((line) => {
    if (line.trimStart().startsWith("```")) { insideBlock = !insideBlock; return line; }
    if (insideBlock) return line;
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#") && !trimmed.startsWith("-") && !trimmed.startsWith("*") && !trimmed.startsWith(">") && !trimmed.startsWith("|")) {
      converted++;
      return `- ${trimmed}`;
    }
    return line;
  });
  return { lines: result, converted };
}

// Fixes @ import paths that are missing a required prefix.
// Gemini CLI and Amp both require ./ ../ / or ~/ — bare @word is not resolved.
function fixAtImportPaths(lines: string[]): { lines: string[]; fixed: number } {
  let fixed = 0;
  let insideBlock = false;
  const BARE_AT = /@(?!\.\/|\.\.\/|\/|~\/)([^\s,*@]+)/g;
  const result = lines.map((line) => {
    if (line.trimStart().startsWith("```")) { insideBlock = !insideBlock; return line; }
    if (insideBlock) return line;
    const replaced = line.replace(BARE_AT, (_, path) => { fixed++; return `@./${path}`; });
    return replaced;
  });
  return { lines: result, fixed };
}

function applyPlatformOptimizations(
  content: string,
  config: ParsedConfig,
  issues: Issue[]
): { content: string; changes: string[] } {
  const changes: string[] = [];
  const hasCodes = (...codes: string[]) => codes.some((c) => issues.some((i) => i.code === c));
  let lines = content.split("\n");

  switch (config.platform) {
    case "claude": {
      // Add Commands section with runnable stub when no build/test commands are found
      if (hasCodes("CLAUDE_MISSING_BUILD_COMMANDS")) {
        const stub = [
          "",
          "## Commands",
          "```bash",
          "# [TODO: build command, e.g. npm run build]",
          "# [TODO: test command, e.g. npm test]",
          "# [TODO: lint command, e.g. npm run lint]",
          "```",
          "",
        ];
        lines = [...lines, ...stub];
        changes.push("Added Commands section stub — fill in build, test, and lint commands so Claude Code can run them without discovery overhead");
      }

      // Flag unfilled placeholders — cannot auto-fix without project-specific context
      if (hasCodes("CLAUDE_PLACEHOLDER_FOUND")) {
        const count = (content.match(/\[TODO:/g) ?? []).length;
        changes.push(`Found ${count} unfilled [TODO:] placeholder(s) — fill these in before relying on this config`);
      }
      break;
    }

    case "cursor": {
      // Prepend frontmatter stub to .cursor/rules/ files that are missing it
      if (hasCodes("CURSOR_MISSING_FRONTMATTER")) {
        const stub = [
          "---",
          "description: [TODO: describe when this rule applies]",
          "globs: []",
          "alwaysApply: false",
          "---",
          "",
        ];
        lines = [...stub, ...lines];
        changes.push("Added Cursor rule frontmatter stub — set 'globs' or 'alwaysApply: true' to control scope");
      }
      break;
    }

    case "cline": {
      // Convert unstructured prose to bullet points
      if (hasCodes("CLINE_UNSTRUCTURED_RULES")) {
        const { lines: bulleted, converted } = proseTooBullets(lines);
        if (converted > 0) {
          lines = bulleted;
          changes.push(`Converted ${converted} prose line(s) to bullet points (Cline: "bullet points make individual requirements clear")`);
        }
      }
      break;
    }

    case "gemini": {
      // Fix invalid @ import paths (missing ./ prefix)
      if (hasCodes("GEMINI_IMPORT_INVALID_PATH")) {
        const { lines: fixed, fixed: count } = fixAtImportPaths(lines);
        if (count > 0) {
          lines = fixed;
          changes.push(`Fixed ${count} @-import path(s) to use ./ prefix — required by Gemini CLI's import processor`);
        }
      }
      break;
    }

    case "amp": {
      // Fix bare @path → @./path to prevent Amp's implicit **/ recursive prepend
      if (hasCodes("AMP_IMPORT_IMPLICIT_RECURSIVE")) {
        const { lines: fixed, fixed: count } = fixAtImportPaths(lines);
        if (count > 0) {
          lines = fixed;
          changes.push(`Fixed ${count} @-mention path(s) to use ./ prefix — prevents Amp from prepending **/ and matching files across the entire project`);
        }
      }
      break;
    }

    case "copilot": {
      // Add applyTo frontmatter stub to .github/instructions/ files missing it
      if (hasCodes("COPILOT_INSTRUCTIONS_MISSING_APPLY_TO") && !content.trimStart().startsWith("---")) {
        const stub = [
          "---",
          "applyTo: '[TODO: glob pattern, e.g. **/*.rb or src/**/*.ts]'",
          "---",
          "",
        ];
        lines = [...stub, ...lines];
        changes.push("Added applyTo frontmatter stub — specify a glob pattern to scope this instruction file to matching paths");
      }
      break;
    }
  }

  return { content: lines.join("\n"), changes };
}

function moveCriticalRulesToTop(lines: string[], issues: Issue[]): { lines: string[]; moved: boolean } {
  const hasAttentionIssue = issues.some((i) => i.code === "ATTENTION_PLACEMENT");
  if (!hasAttentionIssue) return { lines, moved: false };

  const criticalKeywords = /\b(important|critical|never|always|must|required|forbidden|do not|don't)\b/i;
  const firstHeading = lines.findIndex((l) => l.startsWith("#"));
  if (firstHeading === -1) return { lines, moved: false };

  const criticalLines: number[] = [];
  for (let i = firstHeading + 1; i < lines.length; i++) {
    if (criticalKeywords.test(lines[i]) && !lines[i].startsWith("#")) {
      criticalLines.push(i);
    }
  }

  if (criticalLines.length === 0) return { lines, moved: false };

  // Insert a "Critical Rules" section right after the first heading
  const insertAt = firstHeading + 1;
  const extracted = criticalLines.map((idx) => lines[idx]);
  const remaining = lines.filter((_, i) => !criticalLines.includes(i));

  const newLines = [
    ...remaining.slice(0, insertAt),
    "",
    "## Critical Rules",
    ...extracted,
    "",
    ...remaining.slice(insertAt),
  ];

  return { lines: newLines, moved: true };
}

export function optimize(
  config: ParsedConfig,
  analysis: AnalysisResult,
  scoreResult: ScoreResult
): OptimizationResult {
  const changes: string[] = [];
  let content = config.content;

  // Platform-specific structural fixes (frontmatter, import paths, prose format)
  // Run first so subsequent passes work on already-corrected structure.
  const { content: platformFixed, changes: platformChanges } = applyPlatformOptimizations(
    content,
    config,
    analysis.issues
  );
  if (platformChanges.length > 0) {
    content = platformFixed;
    changes.push(...platformChanges);
  }

  // Fix vague rules
  const { content: fixedVague, replacements } = fixVagueRules(content);
  if (replacements > 0) {
    content = fixedVague;
    changes.push(`Replaced ${replacements} vague directive(s) with concrete alternatives`);
  }

  // Deduplicate lines
  const { lines: dedupedLines, removed } = deduplicateLines(content.split("\n"));
  if (removed > 0) {
    content = dedupedLines.join("\n");
    changes.push(`Removed ${removed} duplicate line(s)`);
  }

  // Move critical rules toward top
  const { lines: reorderedLines, moved } = moveCriticalRulesToTop(
    content.split("\n"),
    analysis.issues
  );
  if (moved) {
    content = reorderedLines.join("\n");
    changes.push("Moved critical rules (never/always/must) to the top of the file for better LLM attention");
  }

  // Add missing section stubs (platform-aware content hints)
  const { content: withStubs, added } = addMissingSectionStubs(
    content,
    analysis.checks.missingSections.missing,
    config.platform
  );
  if (added.length > 0) {
    content = withStubs;
    changes.push(`Added stub sections: ${added.join(", ")}`);
  }

  if (changes.length === 0) {
    changes.push("No changes needed — config looks well-structured");
  }

  return { optimizedContent: content, changesSummary: changes };
}
