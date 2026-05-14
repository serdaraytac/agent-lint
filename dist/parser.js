const FILENAME_PLATFORM_MAP = {
    "claude.md": "claude",
    "claude.local.md": "claude",
    ".cursorrules": "cursor",
    "cursor.md": "cursor",
    ".clinerules": "cline",
    "cline.md": "cline",
    "codex.md": "codex",
    "agents.md": "codex",
    "gemini.md": "gemini",
    ".gemini/GEMINI.md": "gemini",
    "copilot-instructions.md": "copilot",
    ".windsurfrules": "windsurf",
    "windsurf.md": "windsurf",
    ".amp/instructions.md": "amp",
    ".antigravity/instructions.md": "antigravity",
    "opencode.md": "opencode",
    "kimi.md": "kimi",
    ".warp/instructions.md": "warp",
    "warp.md": "warp",
    "firebender.xml": "firebender",
};
export function detectPlatform(filename) {
    const normalized = filename.toLowerCase().replace(/\\/g, "/");
    const basename = normalized.split("/").pop() ?? normalized;
    // .cursor/rules/*.md files are Cursor rule files regardless of their basename
    if (normalized.includes(".cursor/rules/"))
        return "cursor";
    // .clinerules/ directory files are Cline rule files regardless of their basename
    if (normalized.includes(".clinerules/"))
        return "cline";
    // .github/instructions/*.instructions.md are path-specific Copilot instruction files
    if (normalized.includes(".github/instructions/"))
        return "copilot";
    for (const [pattern, platform] of Object.entries(FILENAME_PLATFORM_MAP)) {
        if (normalized.endsWith(pattern.toLowerCase()) || basename === pattern.toLowerCase()) {
            return platform;
        }
    }
    if (basename.includes("claude"))
        return "claude";
    if (basename.includes("cursor"))
        return "cursor";
    if (basename.includes("cline"))
        return "cline";
    if (basename.includes("codex"))
        return "codex";
    if (basename.includes("gemini"))
        return "gemini";
    if (basename.includes("copilot"))
        return "copilot";
    if (basename.includes("windsurf"))
        return "windsurf";
    if (basename.includes("amp"))
        return "amp";
    if (basename.includes("kimi"))
        return "kimi";
    if (basename.includes("warp"))
        return "warp";
    return "unknown";
}
function extractSections(lines) {
    const sections = [];
    let currentSection = null;
    const contentLines = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const headingMatch = line.match(/^(#{1,6})\s+(.+)/);
        if (headingMatch) {
            if (currentSection?.heading !== undefined) {
                sections.push({
                    heading: currentSection.heading,
                    level: currentSection.level,
                    startLine: currentSection.startLine,
                    endLine: i - 1,
                    content: contentLines.join("\n"),
                });
                contentLines.length = 0;
            }
            currentSection = {
                heading: headingMatch[2].trim(),
                level: headingMatch[1].length,
                startLine: i,
            };
        }
        else if (currentSection) {
            contentLines.push(line);
        }
    }
    if (currentSection?.heading !== undefined) {
        sections.push({
            heading: currentSection.heading,
            level: currentSection.level,
            startLine: currentSection.startLine,
            endLine: lines.length - 1,
            content: contentLines.join("\n"),
        });
    }
    return sections;
}
export function parseConfig(filename, content) {
    const lines = content.split("\n");
    const sections = extractSections(lines);
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    return {
        platform: detectPlatform(filename),
        filename,
        content,
        lines,
        sections,
        wordCount,
        charCount: content.length,
    };
}
//# sourceMappingURL=parser.js.map