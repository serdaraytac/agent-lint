export type Platform = "claude" | "cursor" | "cline" | "codex" | "gemini" | "copilot" | "windsurf" | "amp" | "antigravity" | "opencode" | "kimi" | "warp" | "firebender" | "unknown";
export interface ParsedConfig {
    platform: Platform;
    filename: string;
    content: string;
    lines: string[];
    sections: Section[];
    wordCount: number;
    charCount: number;
}
export interface Section {
    heading: string;
    level: number;
    startLine: number;
    endLine: number;
    content: string;
}
export declare function detectPlatform(filename: string): Platform;
export declare function parseConfig(filename: string, content: string): ParsedConfig;
//# sourceMappingURL=parser.d.ts.map