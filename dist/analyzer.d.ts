import type { ParsedConfig, Platform } from "./parser.js";
import { type PlatformProfile } from "./platforms.js";
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
export type VagueCategory = "unmeasurable-quality" | "false-shared-context" | "passive-voice" | "weak-obligation" | "vague-condition" | "comparative-without-baseline" | "outcome-without-criterion";
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
    duplicatePhrases: Array<{
        phrase: string;
        occurrences: number;
        lines: number[];
    }>;
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
export declare function analyzeTokenCost(config: ParsedConfig, profile?: PlatformProfile): TokenCostResult;
export declare function analyzeVagueRules(config: ParsedConfig): VagueRulesResult;
export declare function analyzeMissingSections(config: ParsedConfig, profile?: PlatformProfile): MissingSectionsResult;
export declare function analyzeDuplicates(config: ParsedConfig): DuplicatesResult;
export declare function analyzeAttentionPlacement(config: ParsedConfig): AttentionPlacementResult;
export declare function analyzeStructure(config: ParsedConfig): StructureResult;
export declare function analyzeFormatCompliance(config: ParsedConfig): FormatComplianceResult;
export declare function analyze(config: ParsedConfig): AnalysisResult;
//# sourceMappingURL=analyzer.d.ts.map