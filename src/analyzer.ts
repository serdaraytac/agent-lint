import type { ParsedConfig, Platform, Section } from "./parser.js";
import { getProfile, type PlatformProfile } from "./platforms.js";

export type Severity = "critical" | "warning" | "info";

export interface Issue {
  code: string;
  severity: Severity;
  message: string;
  line?: number;
  context?: string;
}

export interface AnalysisResult {
  platform: Platform;
  tokenCount: number;
  estimatedCostUsd: number;
  issues: Issue[];
  checks: {
    tokenCost: TokenCostResult;
    vagueRules: VagueRulesResult;
    missingSections: MissingSectionsResult;
    duplicates: DuplicatesResult;
    attentionPlacement: AttentionPlacementResult;
    structure: StructureResult;
    formatCompliance: FormatComplianceResult;
  };
}

export interface TokenCostResult {
  charCount: number;
  tokenCount: number;
  estimatedCostUsd: number;
  costPerSession: number;
}

export type VagueCategory =
  | "unmeasurable-quality"
  | "false-shared-context"
  | "passive-voice"
  | "weak-obligation"
  | "vague-condition"
  | "comparative-without-baseline"
  | "outcome-without-criterion";

export interface VagueLine {
  line: number;
  text: string;
  reason: string;
  category: VagueCategory;
}

export interface VagueRulesResult {
  vagueLines: VagueLine[];
}

export interface MissingSectionsResult {
  missing: string[];
  present: string[];
}

export interface DuplicatesResult {
  duplicatePhrases: Array<{ phrase: string; occurrences: number; lines: number[] }>;
}

export interface AttentionPlacementResult {
  criticalInHead: boolean;
  criticalInTail: boolean;
  headLines: string[];
  tailLines: string[];
  suggestions: string[];
}

export interface StructureResult {
  hasHeadings: boolean;
  headingCount: number;
  maxDepth: number;
  longParagraphLines: number[];
  unorganizedRuleCount: number;
}

export interface FormatComplianceResult {
  issues: Issue[];
}

const CHARS_PER_TOKEN = 4;

interface VaguePattern {
  pattern: RegExp;
  reason: string;
  category: VagueCategory;
}

// Patterns derived from Anthropic context engineering article, The Prompt Report (arXiv:2406.06608),
// and prompt knowledge-gap research (arXiv:2501.11709).
const VAGUE_PATTERNS: VaguePattern[] = [
  // --- unmeasurable-quality: subjective adjectives with no measurable criterion ---
  { pattern: /\bwrite\s+(good|great|better|clean|quality|nice)\b/i, reason: "Subjective quality term — specify measurable criteria (e.g. passes linting, all tests green)", category: "unmeasurable-quality" },
  { pattern: /\b(elegant|robust)\b/i, reason: "Subjective attribute — define what this means concretely for this codebase", category: "unmeasurable-quality" },
  { pattern: /\bwell[\s-]?(written|structured|organized|documented)\b/i, reason: "Unmeasurable quality claim — replace with a specific convention or checklist item", category: "unmeasurable-quality" },
  { pattern: /\bhigh[\s-]?quality\b/i, reason: "\"High quality\" is not measurable — specify the criteria (test coverage, lint, types)", category: "unmeasurable-quality" },
  { pattern: /\bmaintainable\b/i, reason: "\"Maintainable\" is subjective — describe concrete patterns (e.g. max function length, no side effects)", category: "unmeasurable-quality" },
  { pattern: /\breadable\b/i, reason: "\"Readable\" is subjective — specify conventions (naming rules, comment policy, line length)", category: "unmeasurable-quality" },
  { pattern: /\bproper(ly)?\b/i, reason: "\"Proper\" is undefined — specify what the correct approach is in this context", category: "unmeasurable-quality" },

  // --- false-shared-context: rules that assume unstated shared knowledge ---
  { pattern: /\bfollow\s+best\s+practices\b/i, reason: "\"Best practices\" is undefined — name the specific practices or link a reference", category: "false-shared-context" },
  { pattern: /\buse\s+common\s+sense\b/i, reason: "\"Common sense\" assumes shared context the model may not have — make the rule explicit", category: "false-shared-context" },
  { pattern: /\buse\s+(your\s+)?judgment\b/i, reason: "Delegating to judgment provides no actionable guidance — define the decision criteria", category: "false-shared-context" },
  { pattern: /\buse\s+standard\s+patterns?\b/i, reason: "\"Standard patterns\" is ambiguous — specify which patterns apply (e.g. repository pattern, factory)", category: "false-shared-context" },
  { pattern: /\bindustry\s+standards?\b/i, reason: "\"Industry standard\" varies by context — name the specific standard or spec", category: "false-shared-context" },
  { pattern: /\bfollow\s+(the\s+)?conventions?\b/i, reason: "\"Conventions\" is undefined here — specify which file or section defines them", category: "false-shared-context" },
  { pattern: /\bconventional\s+(approach|way|method)\b/i, reason: "\"Conventional\" assumes shared knowledge — describe the expected approach explicitly", category: "false-shared-context" },
  { pattern: /\bstandard\s+(way|approach|practice)\b/i, reason: "\"Standard\" is undefined without a reference — name the specific practice", category: "false-shared-context" },

  // --- passive-voice: passive constructions that omit the responsible agent ---
  { pattern: /\bshould\s+be\s+(done|handled|implemented|addressed|considered|reviewed|tested)\b/i, reason: "Passive voice omits who is responsible — rewrite as an active directive (e.g. \"You must handle X by...\")", category: "passive-voice" },
  { pattern: /\bneeds?\s+to\s+be\s+(handled|done|checked|fixed|resolved|addressed)\b/i, reason: "Passive construction — specify who does this and how", category: "passive-voice" },
  { pattern: /\bmust\s+be\s+considered\b/i, reason: "\"Must be considered\" has no action — specify what action to take when this applies", category: "passive-voice" },
  { pattern: /\bis\s+expected\s+to\b/i, reason: "Passive expectation — rewrite as an explicit directive with a clear subject", category: "passive-voice" },

  // --- weak-obligation: soft modals that dilute the rule's force ---
  { pattern: /\btry\s+to\b/i, reason: "\"Try to\" is a soft obligation — use \"must\" or \"always\" if the rule is mandatory, or remove if truly optional", category: "weak-obligation" },
  { pattern: /\battempt\s+to\b/i, reason: "\"Attempt to\" signals optional behavior — state clearly whether this is required or not", category: "weak-obligation" },
  { pattern: /\bconsider\s+(using|adding|implementing|making|doing)\b/i, reason: "\"Consider\" leaves the decision open — either make it a rule or remove it", category: "weak-obligation" },
  { pattern: /\bmight\s+want\s+to\b/i, reason: "\"Might want to\" is not a directive — state the rule clearly", category: "weak-obligation" },
  { pattern: /\bit\s+would\s+be\s+(good|nice|helpful|better)\s+to\b/i, reason: "Suggestion rather than a rule — convert to a clear directive or omit", category: "weak-obligation" },
  { pattern: /\bideally\b/i, reason: "\"Ideally\" implies the rule is aspirational, not enforced — clarify the actual expectation", category: "weak-obligation" },

  // --- vague-condition: conditions without measurable thresholds ---
  { pattern: /\bappropriate(ly)?\b/i, reason: "\"Appropriate\" is subjective — define the criteria that determine appropriateness", category: "vague-condition" },
  { pattern: /\bas\s+needed\b/i, reason: "\"As needed\" is ambiguous — define the condition that triggers this action", category: "vague-condition" },
  { pattern: /\bwhen\s+(necessary|applicable|possible|appropriate)\b/i, reason: "Conditional without a defined trigger — specify when exactly this applies", category: "vague-condition" },
  { pattern: /\bif\s+(necessary|needed|required|applicable)\b/i, reason: "Conditional without defined criteria — make the condition explicit", category: "vague-condition" },
  { pattern: /\bin\s+most\s+cases\b/i, reason: "\"In most cases\" is undefined — either make the rule universal or list the exceptions explicitly", category: "vague-condition" },
  { pattern: /\bin\s+general\b/i, reason: "\"In general\" allows uncontrolled exceptions — state the rule and its explicit exceptions separately", category: "vague-condition" },
  { pattern: /\bwhere\s+(possible|feasible)\b/i, reason: "\"Where possible\" creates an escape hatch without criteria — define what makes it impossible", category: "vague-condition" },
  { pattern: /\bfor\s+(large|complex|small)\s+(files?|functions?|classes?|components?)\b/i, reason: "Threshold is undefined — specify a measurable limit (e.g. functions over 50 lines, files over 300 lines)", category: "vague-condition" },

  // --- comparative-without-baseline: comparisons with no reference point ---
  { pattern: /\bas\s+\w+\s+as\s+possible\b/i, reason: "Relative goal without a stopping criterion — specify the concrete target (e.g. under 200ms, under 50 lines)", category: "comparative-without-baseline" },
  { pattern: /\bimprove\s+(performance|readability|maintainability|quality)\b/i, reason: "\"Improve\" without a baseline or target is not actionable — specify the current state and goal", category: "comparative-without-baseline" },
  { pattern: /\b(better|cleaner|simpler|faster)\s+(code|approach|solution|implementation)\b/i, reason: "Comparative without a reference point — define what the acceptable baseline looks like", category: "comparative-without-baseline" },
  { pattern: /\befficient(ly)?\s+as\s+possible\b/i, reason: "Relative efficiency without a benchmark — define a measurable performance target", category: "comparative-without-baseline" },
  { pattern: /\boptimize\s+(for\s+)?(performance|speed|memory|readability)\b/i, reason: "Optimization without a target metric — specify the threshold or trade-off criteria", category: "comparative-without-baseline" },

  // --- outcome-without-criterion: desired outcomes with no success definition ---
  { pattern: /\bensure\s+(quality|correctness|accuracy|consistency)\b/i, reason: "Vague outcome directive — define how quality/correctness is verified (e.g. all tests pass, no type errors)", category: "outcome-without-criterion" },
  { pattern: /\bmaintain\s+(standards?|quality|consistency)\b/i, reason: "\"Maintain\" without a definition is not enforceable — reference the specific standard or checklist", category: "outcome-without-criterion" },
  { pattern: /\bbe\s+(thorough|careful|diligent|mindful|consistent)\b/i, reason: "Behavioral directive without success criteria — describe what thoroughness/care means in this context", category: "outcome-without-criterion" },
  { pattern: /\bpay\s+attention\s+to\b/i, reason: "\"Pay attention to\" has no defined action — replace with a concrete check or rule", category: "outcome-without-criterion" },
  { pattern: /\bhandle\s+(errors?|edge\s+cases?)\s+properly\b/i, reason: "\"Properly\" is undefined — specify the error handling strategy (e.g. log and rethrow, return Result type)", category: "outcome-without-criterion" },
  { pattern: /\bsimple(r|ly)?\b/i, reason: "\"Simple\" is relative — describe what simplicity means here (e.g. cyclomatic complexity ≤ 5)", category: "outcome-without-criterion" },
];


export function analyzeTokenCost(config: ParsedConfig, profile?: PlatformProfile): TokenCostResult {
  profile ??= getProfile(config.platform);
  const tokenCount = Math.ceil(config.charCount / CHARS_PER_TOKEN);
  const costPerSession = profile.subscriptionBased
    ? 0
    : tokenCount * (profile.costPerMillion / 1_000_000);
  return {
    charCount: config.charCount,
    tokenCount,
    estimatedCostUsd: costPerSession,
    costPerSession,
  };
}

export function analyzeVagueRules(config: ParsedConfig): VagueRulesResult {
  const vagueLines: VagueLine[] = [];

  for (let i = 0; i < config.lines.length; i++) {
    const line = config.lines[i];
    if (!line.trim() || line.startsWith("#")) continue;

    for (const { pattern, reason, category } of VAGUE_PATTERNS) {
      if (pattern.test(line)) {
        vagueLines.push({ line: i + 1, text: line.trim(), reason, category });
        break;
      }
    }
  }

  return { vagueLines };
}

export function analyzeMissingSections(config: ParsedConfig, profile?: PlatformProfile): MissingSectionsResult {
  profile ??= getProfile(config.platform);
  const expected = profile.expectedSections;
  const headings = config.sections.map((s) => s.heading.toLowerCase());

  const present: string[] = [];
  const missing: string[] = [];

  for (const section of expected) {
    const found = headings.some((h) => h.includes(section));
    if (found) {
      present.push(section);
    } else {
      missing.push(section);
    }
  }

  return { missing, present };
}

export function analyzeDuplicates(config: ParsedConfig): DuplicatesResult {
  const phraseMap = new Map<string, number[]>();

  for (let i = 0; i < config.lines.length; i++) {
    const line = config.lines[i].trim().toLowerCase();
    if (line.length < 20 || line.startsWith("#")) continue;

    // Extract 5-word ngrams to find duplicate content
    const words = line.split(/\s+/);
    if (words.length < 5) continue;

    for (let j = 0; j <= words.length - 5; j++) {
      const phrase = words.slice(j, j + 5).join(" ");
      if (!phraseMap.has(phrase)) {
        phraseMap.set(phrase, []);
      }
      phraseMap.get(phrase)!.push(i + 1);
    }
  }

  const duplicatePhrases = Array.from(phraseMap.entries())
    .filter(([, lines]) => {
      // Only flag if it appears on different lines
      const uniqueLines = [...new Set(lines)];
      return uniqueLines.length > 1;
    })
    .map(([phrase, lines]) => ({
      phrase,
      occurrences: [...new Set(lines)].length,
      lines: [...new Set(lines)],
    }))
    // Deduplicate overlapping ngrams — keep only the first representative
    .slice(0, 10);

  return { duplicatePhrases };
}

export function analyzeAttentionPlacement(config: ParsedConfig): AttentionPlacementResult {
  const totalLines = config.lines.length;
  const headSize = Math.min(10, Math.floor(totalLines * 0.15));
  const tailSize = Math.min(10, Math.floor(totalLines * 0.15));

  const headLines = config.lines.slice(0, headSize);
  const tailLines = config.lines.slice(Math.max(0, totalLines - tailSize));

  const criticalKeywords = /\b(important|critical|never|always|must|required|forbidden|do not|don't)\b/i;

  const criticalInHead = headLines.some((l) => criticalKeywords.test(l));
  const criticalInTail = tailLines.some((l) => criticalKeywords.test(l));

  const suggestions: string[] = [];

  if (!criticalInHead && !criticalInTail) {
    // Check if critical content exists anywhere
    const hasCritical = config.lines.some((l) => criticalKeywords.test(l));
    if (hasCritical) {
      suggestions.push("Move critical rules (never/always/must) to the first or last 15% of the file for better LLM attention");
    }
  }

  if (!criticalInHead && criticalInTail) {
    suggestions.push("Critical rules found only at the tail — consider also adding a brief summary at the top");
  }

  return { criticalInHead, criticalInTail, headLines, tailLines, suggestions };
}

export function analyzeStructure(config: ParsedConfig): StructureResult {
  const hasHeadings = config.sections.length > 0;
  const headingCount = config.sections.length;
  const maxDepth = config.sections.reduce((max, s) => Math.max(max, s.level), 0);

  // Lines that are long prose paragraphs (>120 chars, not a heading/list)
  const longParagraphLines: number[] = [];
  for (let i = 0; i < config.lines.length; i++) {
    const line = config.lines[i];
    if (line.length > 120 && !line.startsWith("#") && !line.startsWith("-") && !line.startsWith("*")) {
      longParagraphLines.push(i + 1);
    }
  }

  // Rules not under any heading (appear before the first heading)
  const firstHeadingLine = config.sections[0]?.startLine ?? config.lines.length;
  const unorganizedRuleCount = config.lines
    .slice(0, firstHeadingLine)
    .filter((l) => l.trim() && !l.startsWith("#")).length;

  return { hasHeadings, headingCount, maxDepth, longParagraphLines, unorganizedRuleCount };
}

// Copilot: repository-wide instructions at .github/copilot-instructions.md; path-specific rules at
// .github/instructions/*.instructions.md with applyTo frontmatter. excludeAgent accepts only
// "code-review" or "cloud-agent". Source: docs.github.com/en/copilot/customizing-copilot/
function checkCopilotFormat(config: ParsedConfig): Issue[] {
  const issues: Issue[] = [];
  const normalized = config.filename.toLowerCase().replace(/\\/g, "/");
  const basename = normalized.split("/").pop() ?? normalized;
  const isPathSpecific = normalized.includes(".github/instructions/");

  // Repository-wide instructions.md must live inside .github/ — files elsewhere are not recognized.
  if (basename === "copilot-instructions.md" && !normalized.includes(".github/")) {
    issues.push({
      code: "COPILOT_WRONG_LOCATION",
      severity: "critical",
      message: "copilot-instructions.md must be placed inside the .github/ directory — GitHub Copilot does not recognize it at any other location (docs.github.com/en/copilot/customizing-copilot/adding-repository-custom-instructions-for-github-copilot)",
    });
    return issues;
  }

  // Path-specific instruction files must end in .instructions.md and require applyTo frontmatter.
  if (isPathSpecific) {
    if (!basename.endsWith(".instructions.md")) {
      issues.push({
        code: "COPILOT_INSTRUCTIONS_WRONG_EXTENSION",
        severity: "warning",
        message: "Files in .github/instructions/ must end with .instructions.md to be recognized by GitHub Copilot — rename this file accordingly",
      });
      return issues;
    }

    const hasFrontmatter = config.content.trimStart().startsWith("---");
    if (!hasFrontmatter) {
      issues.push({
        code: "COPILOT_INSTRUCTIONS_MISSING_APPLY_TO",
        severity: "warning",
        message: "Path-specific instruction files in .github/instructions/ should have an 'applyTo:' frontmatter field to scope them to matching files (e.g. applyTo: '**/*.rb') — without it the file is applied repository-wide",
      });
    } else {
      const closeIdx = config.content.indexOf("---", 3);
      const frontmatter = closeIdx > -1 ? config.content.slice(3, closeIdx) : "";

      if (!frontmatter.includes("applyTo")) {
        issues.push({
          code: "COPILOT_INSTRUCTIONS_MISSING_APPLY_TO",
          severity: "warning",
          message: "Frontmatter is present but missing 'applyTo:' — add a glob pattern (e.g. applyTo: '**/*.rb') to scope this instruction file to specific paths",
        });
      }

      // excludeAgent only accepts "code-review" or "cloud-agent"
      const excludeMatch = frontmatter.match(/excludeAgent:\s*["']?([^"'\n]+)["']?/);
      if (excludeMatch) {
        const val = excludeMatch[1].trim();
        if (val !== "code-review" && val !== "cloud-agent") {
          issues.push({
            code: "COPILOT_INVALID_EXCLUDE_AGENT",
            severity: "warning",
            message: `excludeAgent: "${val}" is not a valid value — GitHub Copilot only accepts "code-review" or "cloud-agent"`,
          });
        }
      }
    }

    return issues;
  }

  // Repository-wide copilot-instructions.md size checks (existing documented limits).
  if (config.charCount > 4_000) {
    issues.push({
      code: "COPILOT_SIZE_LIMIT",
      severity: "warning",
      message: `File is ${config.charCount} characters — GitHub Copilot's code review feature reads only the first 4,000 characters; content beyond that is ignored during reviews`,
    });
  }

  if (config.lines.length > 1_000) {
    issues.push({
      code: "COPILOT_LINE_LIMIT",
      severity: "warning",
      message: `File has ${config.lines.length} lines — GitHub documentation states response quality may deteriorate beyond ~1,000 lines; split into multiple instruction files`,
    });
  }

  return issues;
}

// Cursor: .cursor/rules/*.md files require YAML frontmatter with valid keys.
// Valid frontmatter keys: description, globs, alwaysApply — any others are silently ignored.
// .cursorrules is the legacy format; the current system is .cursor/rules/*.md (or *.mdc).
// Best practice: keep rules under 500 lines; split large rules into composable files.
// Source: cursor.com/docs/context/rules
function checkCursorFormat(config: ParsedConfig): Issue[] {
  const issues: Issue[] = [];
  const normalized = config.filename.toLowerCase().replace(/\\/g, "/");
  const basename = normalized.split("/").pop() ?? normalized;

  // .cursorrules is the legacy format — current Cursor docs no longer mention it
  if (basename === ".cursorrules") {
    issues.push({
      code: "CURSOR_CURSORRULES_LEGACY",
      severity: "info",
      message: ".cursorrules is the legacy Cursor rules format — migrate to .cursor/rules/*.md (or *.mdc) files with YAML frontmatter for full scope control; the old format is no longer documented at cursor.com/docs/context/rules",
    });
    return issues;
  }

  if (!normalized.includes(".cursor/rules/")) return issues;

  // 500-line best practice (explicitly documented at cursor.com/docs/context/rules)
  if (config.lines.length > 500) {
    issues.push({
      code: "CURSOR_RULE_TOO_LONG",
      severity: "warning",
      message: `Rule file has ${config.lines.length} lines — Cursor documentation recommends keeping rules under 500 lines; split into multiple composable rule files`,
    });
  }

  const hasFrontmatter = config.content.trimStart().startsWith("---");
  if (!hasFrontmatter) {
    issues.push({
      code: "CURSOR_MISSING_FRONTMATTER",
      severity: "warning",
      message: "Cursor rule files in .cursor/rules/ should have YAML frontmatter — add 'globs' (file patterns) or 'alwaysApply: true' to control when the rule applies",
    });
    return issues;
  }

  const closeIdx = config.content.indexOf("---", 3);
  const frontmatter = closeIdx > -1 ? config.content.slice(3, closeIdx) : "";

  // Detect unknown frontmatter keys — only description, globs, alwaysApply are valid
  const VALID_CURSOR_KEYS = ["description", "globs", "alwaysApply"];
  const keyMatches = frontmatter.matchAll(/^(\w[\w-]*):/gm);
  for (const match of keyMatches) {
    const key = match[1];
    if (!VALID_CURSOR_KEYS.includes(key)) {
      issues.push({
        code: "CURSOR_UNKNOWN_FRONTMATTER_KEY",
        severity: "info",
        message: `Unknown frontmatter key '${key}' — Cursor only recognizes 'description', 'globs', and 'alwaysApply'; unknown keys are silently ignored`,
      });
    }
  }

  if (!frontmatter.includes("globs") && !frontmatter.includes("alwaysApply") && !frontmatter.includes("description")) {
    issues.push({
      code: "CURSOR_FRONTMATTER_INCOMPLETE",
      severity: "info",
      message: "Cursor rule frontmatter is present but missing scope — add 'globs: [\"**/*.ts\"]' or 'alwaysApply: true'; without these the rule requires manual @-mention to activate",
    });
  }

  return issues;
}

// Shared: detect build/test commands that appear outside fenced code blocks.
const COMMAND_PATTERN = /\b(npm run|npm test|npm start|yarn run|yarn test|npx |pnpm run|pnpm test|make |cargo run|go run|python |pytest|jest|vitest)\b/;

function findCommandOutsideBlock(
  config: ParsedConfig,
  code: string,
  severity: Severity,
  message: string
): Issue[] {
  let inCodeBlock = false;
  for (let i = 0; i < config.lines.length; i++) {
    const line = config.lines[i];
    if (line.startsWith("```")) { inCodeBlock = !inCodeBlock; continue; }
    if (!inCodeBlock && !line.startsWith("#") && COMMAND_PATTERN.test(line)) {
      return [{ code, severity, message, line: i + 1 }];
    }
  }
  return [];
}

// Claude Code: CLAUDE.md is injected into every context window — completeness and token efficiency both matter.
// Commands must live in fenced code blocks so Claude Code can parse and run them without reading package.json.
// Supports @-import syntax (@./path.md) to split large files; imports inside code blocks are not resolved.
// Unfilled [TODO:] placeholders left in production configs are worse than omission — the model cannot act on them.
// Source: docs.anthropic.com/en/docs/claude-code/memory
function checkClaudeFormat(config: ParsedConfig): Issue[] {
  const issues: Issue[] = [];

  // Commands outside code blocks
  const commandIssues = findCommandOutsideBlock(
    config,
    "CLAUDE_COMMANDS_NOT_IN_BLOCK",
    "info",
    "Claude Code reads build/test commands from fenced code blocks — wrap them in ``` for reliable parsing"
  );
  issues.push(...commandIssues);

  // No build/test commands anywhere — highest single-value addition to any CLAUDE.md
  if (commandIssues.length === 0 && !COMMAND_PATTERN.test(config.content)) {
    issues.push({
      code: "CLAUDE_MISSING_BUILD_COMMANDS",
      severity: "warning",
      message:
        "No build, test, or lint commands found — add a fenced code block with runnable commands (e.g. npm test, npm run build) so Claude Code can execute them without reading package.json on every request",
    });
  }

  // Unfilled [TODO:] placeholders — incomplete directives the model cannot act on
  const todoCount = (config.content.match(/\[TODO:/g) ?? []).length;
  if (todoCount > 0) {
    issues.push({
      code: "CLAUDE_PLACEHOLDER_FOUND",
      severity: "warning",
      message: `${todoCount} unfilled [TODO:] placeholder(s) — the model cannot act on incomplete directives; fill them in or remove them`,
    });
  }

  // @-imports inside fenced code blocks are treated as literal text, not resolved
  let insideBlock = false;
  const blockedImports: number[] = [];
  for (let i = 0; i < config.lines.length; i++) {
    const line = config.lines[i];
    if (line.trimStart().startsWith("```")) { insideBlock = !insideBlock; continue; }
    if (insideBlock && /@(?:\.\/|\.\.\/|\/)/.test(line)) {
      blockedImports.push(i + 1);
    }
  }
  if (blockedImports.length > 0) {
    issues.push({
      code: "CLAUDE_IMPORT_IN_CODE_BLOCK",
      severity: "info",
      message: `@-import on line${blockedImports.length > 1 ? "s" : ""} ${blockedImports.join(", ")} is inside a fenced code block — Claude Code does not resolve @-imports within code blocks; move outside to activate`,
    });
  }

  // Large file with no @-imports — splitting into subdirectory CLAUDE.md files reduces per-context cost
  if (config.charCount > 10_000 && !/@(?:\.\/|\.\.\/|\/)/.test(config.content)) {
    issues.push({
      code: "CLAUDE_SUBDIR_SPLIT_RECOMMENDED",
      severity: "info",
      message: `File is ${config.charCount} characters — Claude Code loads CLAUDE.md from every directory it navigates to; split into subdirectory CLAUDE.md files to reduce per-context token cost and keep rules close to the code they govern`,
    });
  }

  return issues;
}

// Cline: .clinerules/ directory supports YAML frontmatter with 'paths:' for glob scoping.
// Critical distinction: Cline uses 'paths:' (not 'globs:' — that is Cursor's key, silently ignored by Cline).
// Empty paths: [] means the rule never activates. Only .md and .txt files are processed.
// No @-import syntax — composition is done via the .clinerules/ directory itself (merge all files).
// Source: docs.cline.bot/customization/cline-rules
function checkClineFormat(config: ParsedConfig): Issue[] {
  const issues: Issue[] = [];
  const normalized = config.filename.toLowerCase().replace(/\\/g, "/");
  const isInRulesDir = normalized.includes(".clinerules/");

  if (isInRulesDir) {
    const ext = normalized.split(".").pop() ?? "";
    if (ext !== "md" && ext !== "txt") {
      issues.push({
        code: "CLINE_UNSUPPORTED_EXTENSION",
        severity: "warning",
        message: `File has .${ext} extension — Cline only processes .md and .txt files from the .clinerules/ directory; this file will be silently ignored`,
      });
      return issues;
    }

    if (config.content.trimStart().startsWith("---")) {
      const closeIdx = config.content.indexOf("---", 3);
      const frontmatter = closeIdx > -1 ? config.content.slice(3, closeIdx) : "";

      // 'globs:' is Cursor's key — silently ignored by Cline, rule activates unconditionally
      if (frontmatter.includes("globs:") && !frontmatter.includes("paths:")) {
        issues.push({
          code: "CLINE_WRONG_FRONTMATTER_KEY",
          severity: "warning",
          message: "Frontmatter uses 'globs:' which is Cursor's key — Cline uses 'paths:' for glob scoping; 'globs:' is silently ignored and the rule will activate on every request",
        });
      }

      // Empty paths list means the rule never fires
      if (/paths:\s*\[\s*\]/.test(frontmatter) || /paths:\s*\n\s*\n/.test(frontmatter)) {
        issues.push({
          code: "CLINE_EMPTY_PATHS",
          severity: "warning",
          message: "Frontmatter has an empty 'paths:' list — this rule will never activate; add glob patterns (e.g. 'src/**/*.ts') or remove the paths key to make it always active",
        });
      }
    }
  }

  // @ import syntax is not supported in Cline — unlike Gemini CLI or Amp
  let insideBlock = false;
  for (let i = 0; i < config.lines.length; i++) {
    const line = config.lines[i];
    if (line.trimStart().startsWith("```")) { insideBlock = !insideBlock; continue; }
    if (!insideBlock && /@[./~]/.test(line)) {
      issues.push({
        code: "CLINE_AT_IMPORT_NOT_SUPPORTED",
        severity: "warning",
        message: `Line ${i + 1}: @-import syntax is not supported in Cline — split content into separate files under .clinerules/ directory instead; all .md and .txt files there are merged automatically`,
        line: i + 1,
      });
      break;
    }
  }

  const bulletLines = config.lines.filter((l) => /^\s*[-*]\s/.test(l)).length;
  const contentLines = config.lines.filter((l) => l.trim() && !l.startsWith("#")).length;
  if (contentLines > 5 && bulletLines === 0) {
    issues.push({
      code: "CLINE_UNSTRUCTURED_RULES",
      severity: "info",
      message: "Cline documentation recommends using bullet points and headers to organize rules — \"Bullet points make individual requirements clear\" (docs.cline.bot)",
    });
  }

  return issues;
}

// Codex (AGENTS.md): 32 KiB limit confirmed in source (codex-rs/config/src/config_toml.rs line 67).
// AGENTS.override.md at the same directory level takes precedence over AGENTS.md.
// Codex reads hierarchically from Git root down; files concatenate root-first, closer files override.
// Source: developers.openai.com/codex/guides/agents-md + github.com/openai/codex source
function checkCodexFormat(config: ParsedConfig): Issue[] {
  const issues: Issue[] = [];

  if (config.charCount > 32_768) {
    issues.push({
      code: "CODEX_SIZE_LIMIT",
      severity: "warning",
      message: `File is ${config.charCount} characters — Codex enforces a default 32 KiB (32,768 byte) limit on AGENTS.md via project_doc_max_bytes; content beyond this limit is silently truncated (configurable via ~/.codex/config.toml)`,
    });
  }

  // AGENTS.override.md takes precedence at the same directory level — surface this only when the file
  // is large enough that splitting or overriding becomes relevant (>50% of the 32 KiB limit).
  const basename = config.filename.toLowerCase().split("/").pop() ?? "";
  if (basename === "agents.md" && config.charCount > 16_384) {
    issues.push({
      code: "CODEX_OVERRIDE_FILE_AVAILABLE",
      severity: "info",
      message: "Codex checks for AGENTS.override.md at the same directory level before AGENTS.md — use AGENTS.override.md when you need this directory's rules to take precedence without modifying the shared AGENTS.md",
    });
  }

  return issues;
}

// Windsurf: Windsurf now reads AGENTS.md files dynamically — .windsurfrules is the legacy format.
// Source: docs.windsurf.com/windsurf/cascade/agents-md
function checkWindsurfFormat(config: ParsedConfig): Issue[] {
  const issues: Issue[] = [];

  if (config.filename.toLowerCase().endsWith(".windsurfrules")) {
    issues.push({
      code: "WINDSURF_PREFER_AGENTS_MD",
      severity: "info",
      message: "Windsurf now reads AGENTS.md files dynamically as it navigates the repo — consider migrating from .windsurfrules to AGENTS.md for better compatibility with the current Windsurf Cascade agent",
    });
  }

  return issues;
}

// Gemini CLI: supports @-import syntax (@./path.md, @../path, @/abs, @~/home) for splitting large files.
// Imports inside fenced code blocks are silently ignored. Max import depth: 5 levels.
// Source: geminicli.com/docs/reference/memport (Memory Import Processor)
function checkGeminiFormat(config: ParsedConfig): Issue[] {
  const issues: Issue[] = [];

  let insideBlock = false;
  const activeImports: number[] = [];
  const skippedImports: number[] = [];

  for (let i = 0; i < config.lines.length; i++) {
    const line = config.lines[i];
    if (line.trimStart().startsWith("```")) { insideBlock = !insideBlock; continue; }
    const match = line.match(/@([^\s]+)/);
    if (!match) continue;
    if (insideBlock) {
      skippedImports.push(i + 1);
    } else {
      const path = match[1];
      if (path.startsWith("./") || path.startsWith("../") || path.startsWith("/") || path.startsWith("~/")) {
        activeImports.push(i + 1);
      } else {
        issues.push({
          code: "GEMINI_IMPORT_INVALID_PATH",
          severity: "warning",
          message: `Line ${i + 1}: @${path} — Gemini CLI requires a path prefix: @./relative, @../parent, @/absolute, or @~/home-relative; bare @word is not a valid import`,
          line: i + 1,
        });
      }
    }
  }

  // @ imports inside code blocks are silently ignored by Gemini CLI
  if (skippedImports.length > 0) {
    issues.push({
      code: "GEMINI_IMPORT_IN_CODE_BLOCK",
      severity: "info",
      message: `@-import on line${skippedImports.length > 1 ? "s" : ""} ${skippedImports.join(", ")} is inside a fenced code block — Gemini CLI ignores @-imports within code blocks; move outside to activate`,
    });
  }

  // Large file with no active imports — suggest splitting
  if (config.charCount > 10_000 && activeImports.length === 0) {
    issues.push({
      code: "GEMINI_LARGE_NO_IMPORTS",
      severity: "info",
      message: `File is ${config.charCount} characters — Gemini CLI supports @./path.md import syntax to split content across multiple files; imports resolve recursively up to 5 levels deep (geminicli.com/docs/reference/memport)`,
    });
  }

  return issues;
}

// OpenCode: AGENTS.md at project root is the primary config file.
// CLAUDE.md is accepted as a legacy fallback but AGENTS.md is preferred for clarity.
// No @-import syntax inside AGENTS.md — file composition is handled via opencode.json "instructions" field.
// Source: opencode.ai/docs/rules
function checkOpenCodeFormat(config: ParsedConfig): Issue[] {
  const issues: Issue[] = [];
  const lower = config.filename.toLowerCase();
  const basename = lower.split("/").pop() ?? lower;

  // CLAUDE.md works as fallback but signals Claude Code intent, not OpenCode
  if (basename === "claude.md") {
    issues.push({
      code: "OPENCODE_PREFERS_AGENTS_MD",
      severity: "info",
      message: "OpenCode reads CLAUDE.md as a legacy fallback — rename to AGENTS.md at the project root to make OpenCode intent explicit (opencode.ai/docs/rules)",
    });
  }

  // @ import syntax is not supported within AGENTS.md for OpenCode
  // File composition is done via the "instructions" field in opencode.json
  let insideBlock = false;
  for (let i = 0; i < config.lines.length; i++) {
    const line = config.lines[i];
    if (line.trimStart().startsWith("```")) { insideBlock = !insideBlock; continue; }
    if (!insideBlock && /@[./~]/.test(line)) {
      issues.push({
        code: "OPENCODE_AT_IMPORT_NOT_SUPPORTED",
        severity: "warning",
        message: `Line ${i + 1}: @-import syntax is not supported within AGENTS.md for OpenCode — use the "instructions" field in opencode.json to compose multiple files or reference remote URLs (5-second fetch timeout applies)`,
        line: i + 1,
      });
      break;
    }
  }

  return issues;
}

// Amp: AGENTS.md with @-mention syntax for including other files.
// Paths not starting with ./ or ../ get **/ prepended implicitly (recursive project-wide match).
// @-mentions inside fenced code blocks are silently ignored.
// Source: ampcode.com/manual
function checkAmpFormat(config: ParsedConfig): Issue[] {
  const issues: Issue[] = [];

  if (config.filename.toLowerCase().includes(".amp/instructions")) {
    issues.push({
      code: "AMP_INCORRECT_FILENAME",
      severity: "info",
      message: "Amp's official config file is AGENTS.md (also AGENT.md or CLAUDE.md) placed at the project root — .amp/instructions.md is not recognized by Amp per official documentation (ampcode.com/manual)",
    });
  }

  let insideBlock = false;
  const implicitRecursive: number[] = [];
  const ignoredInBlock: number[] = [];

  for (let i = 0; i < config.lines.length; i++) {
    const line = config.lines[i];
    if (line.trimStart().startsWith("```")) { insideBlock = !insideBlock; continue; }
    const match = line.match(/@([^\s,]+)/);
    if (!match) continue;
    if (insideBlock) {
      ignoredInBlock.push(i + 1);
      continue;
    }
    const path = match[1];
    // Paths without ./ or ../ prefix get **/ prepended — may match more files than intended
    if (!path.startsWith("./") && !path.startsWith("../") && !path.startsWith("/") && !path.startsWith("~/") && !path.startsWith("*")) {
      implicitRecursive.push(i + 1);
    }
  }

  if (ignoredInBlock.length > 0) {
    issues.push({
      code: "AMP_IMPORT_IN_CODE_BLOCK",
      severity: "info",
      message: `@-mention on line${ignoredInBlock.length > 1 ? "s" : ""} ${ignoredInBlock.join(", ")} is inside a fenced code block — Amp ignores @-mentions within code blocks; move outside to activate`,
    });
  }

  for (const lineNum of implicitRecursive) {
    const line = config.lines[lineNum - 1];
    const match = line.match(/@([^\s,]+)/);
    if (!match) continue;
    issues.push({
      code: "AMP_IMPORT_IMPLICIT_RECURSIVE",
      severity: "info",
      message: `Line ${lineNum}: @${match[1]} — Amp implicitly prepends **/ to paths not starting with ./ or ../; this matches recursively across the entire project; use @./${match[1]} to pin to the current directory`,
      line: lineNum,
    });
  }

  return issues;
}

// Warp: official config file is AGENTS.md (or legacy WARP.md). Filename must be ALL CAPS.
// .warp/instructions.md does not appear in official Warp documentation (docs.warp.dev/agent-platform/capabilities/rules/).
function checkWarpFormat(config: ParsedConfig): Issue[] {
  const issues: Issue[] = [];

  if (config.filename.toLowerCase().includes(".warp/instructions")) {
    issues.push({
      code: "WARP_INCORRECT_FILENAME",
      severity: "info",
      message: "Warp's official config file is AGENTS.md (or legacy WARP.md) — .warp/instructions.md is not documented; Warp also requires the filename to be ALL CAPS (AGENTS.md, not agents.md)",
    });
  }

  return issues;
}

// Gemini CLI: official docs specify no ordering requirement for GEMINI.md sections.
// File supports @-import syntax for referencing other files — no platform-specific format checks apply.

// Firebender: config must be XML — markdown headings and plain text are invalid.
function checkFirebenderFormat(config: ParsedConfig): Issue[] {
  const issues: Issue[] = [];
  const trimmed = config.content.trim();

  if (config.lines.some((l) => /^#{1,6}\s/.test(l))) {
    issues.push({
      code: "FIREBENDER_MARKDOWN_IN_XML",
      severity: "warning",
      message: "firebender.xml expects XML format — markdown headings (#) are not valid XML and will be ignored by Firebender",
    });
  }

  if (trimmed.length > 0 && !trimmed.startsWith("<?xml") && !/<[a-zA-Z]/.test(trimmed)) {
    issues.push({
      code: "FIREBENDER_MISSING_XML",
      severity: "critical",
      message: "firebender.xml contains no XML markup — Firebender requires properly tagged XML, not plain text or markdown",
    });
  }

  return issues;
}

export function analyzeFormatCompliance(config: ParsedConfig): FormatComplianceResult {
  let issues: Issue[] = [];

  switch (config.platform) {
    case "claude":     issues = checkClaudeFormat(config);     break;
    case "cursor":     issues = checkCursorFormat(config);     break;
    case "cline":      issues = checkClineFormat(config);      break;
    case "codex":      issues = checkCodexFormat(config);      break;
    case "copilot":    issues = checkCopilotFormat(config);    break;
    case "windsurf":   issues = checkWindsurfFormat(config);   break;
    case "gemini":     issues = checkGeminiFormat(config);     break;
    case "opencode":   issues = checkOpenCodeFormat(config);   break;
    case "amp":        issues = checkAmpFormat(config);        break;
    case "warp":       issues = checkWarpFormat(config);       break;
    case "firebender": issues = checkFirebenderFormat(config); break;
  }

  return { issues };
}

function buildIssues(
  tokenCost: TokenCostResult,
  vagueRules: VagueRulesResult,
  missingSections: MissingSectionsResult,
  duplicates: DuplicatesResult,
  attention: AttentionPlacementResult,
  structure: StructureResult,
  formatCompliance: FormatComplianceResult
): Issue[] {
  const issues: Issue[] = [];

  if (tokenCost.tokenCount > 4000) {
    issues.push({
      code: "TOKEN_COST_HIGH",
      severity: "critical",
      message: `File uses ~${tokenCost.tokenCount} tokens per session (~$${(tokenCost.costPerSession * 100).toFixed(4)}/100 sessions). Consider trimming.`,
    });
  } else if (tokenCost.tokenCount > 2000) {
    issues.push({
      code: "TOKEN_COST_MEDIUM",
      severity: "warning",
      message: `File uses ~${tokenCost.tokenCount} tokens per session. Moderate cost.`,
    });
  }

  for (const { line, text, reason, category } of vagueRules.vagueLines) {
    issues.push({
      code: "VAGUE_RULE",
      severity: "warning",
      message: `[${category}] ${reason}`,
      line,
      context: text,
    });
  }

  for (const section of missingSections.missing) {
    issues.push({
      code: "MISSING_SECTION",
      severity: "info",
      message: `Consider adding a "${section}" section for this platform`,
    });
  }

  if (duplicates.duplicatePhrases.length > 0) {
    const top = duplicates.duplicatePhrases[0];
    issues.push({
      code: "DUPLICATE_CONTENT",
      severity: "warning",
      message: `Duplicate content detected (${duplicates.duplicatePhrases.length} repeated phrase(s)). Example: "${top.phrase}" appears on lines ${top.lines.join(", ")}.`,
    });
  }

  for (const suggestion of attention.suggestions) {
    issues.push({
      code: "ATTENTION_PLACEMENT",
      severity: "warning",
      message: suggestion,
    });
  }

  if (!structure.hasHeadings && (structure.unorganizedRuleCount > 5)) {
    issues.push({
      code: "NO_STRUCTURE",
      severity: "warning",
      message: "File has no markdown headings — group rules under descriptive headings for better clarity",
    });
  }

  if (structure.unorganizedRuleCount > 3) {
    issues.push({
      code: "UNORGANIZED_RULES",
      severity: "info",
      message: `${structure.unorganizedRuleCount} lines appear before any heading — move them under a section`,
    });
  }

  if (structure.longParagraphLines.length > 0) {
    issues.push({
      code: "LONG_PARAGRAPHS",
      severity: "info",
      message: `${structure.longParagraphLines.length} line(s) exceed 120 chars — break into shorter rules or bullet points`,
      line: structure.longParagraphLines[0],
    });
  }

  for (const issue of formatCompliance.issues) {
    issues.push(issue);
  }

  return issues;
}

export function analyze(config: ParsedConfig): AnalysisResult {
  const profile = getProfile(config.platform);
  const tokenCost = analyzeTokenCost(config, profile);
  const vagueRules = analyzeVagueRules(config);
  const missingSections = analyzeMissingSections(config, profile);
  const duplicates = analyzeDuplicates(config);
  const attentionPlacement = analyzeAttentionPlacement(config);
  const structure = analyzeStructure(config);
  const formatCompliance = analyzeFormatCompliance(config);

  const issues = buildIssues(tokenCost, vagueRules, missingSections, duplicates, attentionPlacement, structure, formatCompliance);

  return {
    platform: config.platform,
    tokenCount: tokenCost.tokenCount,
    estimatedCostUsd: tokenCost.costPerSession,
    issues,
    checks: {
      tokenCost,
      vagueRules,
      missingSections,
      duplicates,
      attentionPlacement,
      structure,
      formatCompliance,
    },
  };
}
