import type { ParsedConfig } from "./parser.js";
import type { AnalysisResult } from "./analyzer.js";
import type { ScoreResult } from "./scorer.js";
export interface OptimizationResult {
    optimizedContent: string;
    changesSummary: string[];
}
export declare function optimize(config: ParsedConfig, analysis: AnalysisResult, scoreResult: ScoreResult): OptimizationResult;
//# sourceMappingURL=optimizer.d.ts.map