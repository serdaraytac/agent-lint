import { getProfile } from "./platforms.js";
// Each category is worth 25 points; penalties accumulate within each.
function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
}
// Penalty weights per category, calibrated against:
// - AMBIG-SWE (arXiv:2502.13069): informational gaps hurt most
// - Passive voice study (arXiv:2402.10800): passive voice less harmful than assumed
const CATEGORY_PENALTIES = {
    "false-shared-context": 7, // model fills gaps with its own assumptions
    "outcome-without-criterion": 6, // no success definition → unverifiable output
    "unmeasurable-quality": 5, // subjective → inconsistent output
    "passive-voice": 5, // harmful but less than assumed (arXiv:2402.10800)
    "comparative-without-baseline": 4, // directional but no target
    "vague-condition": 3, // trigger unclear; agent can partially recover
    "weak-obligation": 2, // least harmful — model likely complies anyway
};
function scoreClarity(result) {
    const { vaguenessSensitivity } = getProfile(result.platform);
    let penalty = 0;
    for (const { category } of result.checks.vagueRules.vagueLines) {
        penalty += (CATEGORY_PENALTIES[category] ?? 5) * vaguenessSensitivity;
    }
    return clamp(25 - Math.min(Math.round(penalty), 25));
}
function scoreStructure(result) {
    const { hasHeadings, headingCount, longParagraphLines, unorganizedRuleCount } = result.checks.structure;
    let score = 25;
    if (!hasHeadings)
        score -= 15;
    else if (headingCount < 2)
        score -= 5;
    score -= Math.min(10, longParagraphLines.length * 2);
    score -= Math.min(5, Math.floor(unorganizedRuleCount / 2));
    // Platform-specific format compliance penalties
    for (const issue of result.checks.formatCompliance.issues) {
        if (issue.severity === "critical")
            score -= 10;
        else if (issue.severity === "warning")
            score -= 5;
        else
            score -= 2;
    }
    return clamp(score);
}
function scoreTokenEfficiency(result) {
    const { tokenCount } = result.checks.tokenCost;
    const { duplicatePhrases } = result.checks.duplicates;
    const { contextWindowTokens } = getProfile(result.platform);
    let score = 25;
    // DETAIL (arXiv:2512.02246): specific prompts avg 124 tokens, vague ones avg 57.
    // "Too long" thresholds scale proportionally with the platform's context window.
    // Baseline is 200k tokens (Claude Code); cap scale factor at 5× to stay sensible.
    const scaleFactor = Math.min(contextWindowTokens / 200_000, 5);
    const thresholdModerate = Math.round(1_000 * scaleFactor);
    const thresholdHeavy = Math.round(2_000 * scaleFactor);
    const thresholdBloated = Math.round(4_000 * scaleFactor);
    // Short-file penalties are independent of window size — a 50-token config is useless everywhere.
    if (tokenCount < 50)
        score -= 10;
    else if (tokenCount < 150)
        score -= 3;
    else if (tokenCount > thresholdBloated)
        score -= 15;
    else if (tokenCount > thresholdHeavy)
        score -= 7;
    else if (tokenCount > thresholdModerate)
        score -= 3;
    score -= Math.min(10, duplicatePhrases.length * 3);
    return clamp(score);
}
function scoreCoverage(result) {
    const { missing, present } = result.checks.missingSections;
    const total = missing.length + present.length;
    if (total === 0)
        return 25;
    const coveredRatio = present.length / total;
    let score = Math.round(25 * coveredRatio);
    // Bonus for having critical content placed well
    const { criticalInHead, criticalInTail } = result.checks.attentionPlacement;
    if (criticalInHead || criticalInTail)
        score = Math.min(25, score + 3);
    return clamp(score);
}
function toGrade(overall) {
    if (overall >= 90)
        return "A";
    if (overall >= 75)
        return "B";
    if (overall >= 60)
        return "C";
    if (overall >= 40)
        return "D";
    return "F";
}
export function score(result) {
    const clarity = scoreClarity(result);
    const structure = scoreStructure(result);
    const tokenEfficiency = scoreTokenEfficiency(result);
    const coverage = scoreCoverage(result);
    const overall = clamp(clarity + structure + tokenEfficiency + coverage);
    return {
        overall,
        categories: { clarity, structure, tokenEfficiency, coverage },
        grade: toGrade(overall),
    };
}
//# sourceMappingURL=scorer.js.map