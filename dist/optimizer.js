// Maps vague phrases to concrete alternatives, organized by category.
// Patterns mirror the VAGUE_PATTERNS in analyzer.ts.
// Replacements with $1/$2 use JavaScript's native capture-group substitution.
const VAGUE_REPLACEMENTS = [
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
function deduplicateLines(lines) {
    const seen = new Set();
    const result = [];
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
        }
        else {
            seen.add(normalized);
            result.push(line);
        }
    }
    return { lines: result, removed };
}
function fixVagueRules(content) {
    let result = content;
    let replacements = 0;
    for (const { pattern, suggestion } of VAGUE_REPLACEMENTS) {
        const before = result;
        result = result.replace(pattern, suggestion);
        if (result !== before)
            replacements++;
    }
    return { content: result, replacements };
}
function addMissingSectionStubs(content, missingSections, platform) {
    if (missingSections.length === 0)
        return { content, added: [] };
    const stubs = [];
    const added = [];
    for (const section of missingSections) {
        const capitalized = section.charAt(0).toUpperCase() + section.slice(1);
        stubs.push(`\n## ${capitalized}\n<!-- TODO: Add ${section} guidance for ${platform} -->`);
        added.push(section);
    }
    return { content: content + stubs.join("\n"), added };
}
function moveCriticalRulesToTop(lines, issues) {
    const hasAttentionIssue = issues.some((i) => i.code === "ATTENTION_PLACEMENT");
    if (!hasAttentionIssue)
        return { lines, moved: false };
    const criticalKeywords = /\b(important|critical|never|always|must|required|forbidden|do not|don't)\b/i;
    const firstHeading = lines.findIndex((l) => l.startsWith("#"));
    if (firstHeading === -1)
        return { lines, moved: false };
    const criticalLines = [];
    for (let i = firstHeading + 1; i < lines.length; i++) {
        if (criticalKeywords.test(lines[i]) && !lines[i].startsWith("#")) {
            criticalLines.push(i);
        }
    }
    if (criticalLines.length === 0)
        return { lines, moved: false };
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
export function optimize(config, analysis, scoreResult) {
    const changes = [];
    let content = config.content;
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
    const { lines: reorderedLines, moved } = moveCriticalRulesToTop(content.split("\n"), analysis.issues);
    if (moved) {
        content = reorderedLines.join("\n");
        changes.push("Moved critical rules (never/always/must) to the top of the file for better LLM attention");
    }
    // Add missing section stubs
    const { content: withStubs, added } = addMissingSectionStubs(content, analysis.checks.missingSections.missing, config.platform);
    if (added.length > 0) {
        content = withStubs;
        changes.push(`Added stub sections: ${added.join(", ")}`);
    }
    if (changes.length === 0) {
        changes.push("No changes needed — config looks well-structured");
    }
    return { optimizedContent: content, changesSummary: changes };
}
//# sourceMappingURL=optimizer.js.map