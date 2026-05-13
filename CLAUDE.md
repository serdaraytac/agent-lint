# md-analyzer

## Purpose
Analyze, score, and optimize AI coding agent config files (CLAUDE.md, .cursorrules, .clinerules, CODEX.md, GEMINI.md, .windsurfrules, copilot-instructions.md). Works as an MCP tool.

## Tech Stack
- TypeScript + Node.js 22+
- MCP SDK (@modelcontextprotocol/sdk)

## Supported Platforms
Claude Code, Cursor, Cline, Codex, Gemini CLI, GitHub Copilot, Windsurf, Amp, Antigravity, OpenCode, Kimi Code CLI, Warp, Firebender

## Analysis Criteria
- Token cost estimation (file size → estimated tokens → per-session cost)
- Vague rule detection ("write good content" style ambiguity)
- Missing section check (variables, examples, do/don't rules)
- Duplicate content detection
- Attention placement (critical info at head/tail for LLM U-shaped attention)
- Structure analysis (markdown heading usage, grouping)

## Output Format
- Overall score: 0-100
- Category scores (clarity, structure, token efficiency, coverage)
- Issues list (severity: critical/warning/info)
- Optimized version suggestion

## Rules
- All code, comments, and documentation in English
- Write unit tests for every tool
- Test before creating files
