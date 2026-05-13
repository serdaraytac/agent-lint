import type { AnalysisResult } from "./analyzer.js";
export interface CategoryScores {
    clarity: number;
    structure: number;
    tokenEfficiency: number;
    coverage: number;
}
export interface ScoreResult {
    overall: number;
    categories: CategoryScores;
    grade: "A" | "B" | "C" | "D" | "F";
}
export declare function score(result: AnalysisResult): ScoreResult;
//# sourceMappingURL=scorer.d.ts.map