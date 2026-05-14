# config-mode

**Your AI agent is ignoring your rules — and you don’t even know it.**

config-mode finds why, scores it, and fixes it automatically.

---

## The Problem

AI coding agents don’t follow your rules.

Not because they’re bad —  
because your config files are.

- "Follow best practices" → meaningless to LLMs
- Wrong frontmatter → rules never activate
- Files too large → silently truncated
- Missing sections → incomplete behavior
- Platform differences → inconsistent outputs

👉 You think your agent is broken  
👉 But your config is

---

## What config-mode does

config-mode analyzes your AI agent configs and fixes them.

- **Scores** configs (0–100) across clarity, structure, token efficiency, coverage
- **Detects vague rules** LLMs can’t execute
- **Finds platform-specific bugs** (Cursor, Codex, Copilot, Cline, etc.)
- **Auto-fixes issues** — not just warnings
- **Optimizes token usage** and estimates cost

Works across **13 platforms**.

---

## Example

Before:

```md
Follow best practices.
Handle errors properly.
Write clean code.
```

Run:

```
optimize_config { "filepath": "./backend.md", "write": true }
```

Output:

```bash
Score: 29 (F)
- 3 vague rules
- 1 missing section
- 1 duplicate

✨ Fixed → Score: 68 (C)
```

After:

```md
- follow the conventions defined in this file
- handle errors by [TODO: define strategy]
- easy to extend without modifying existing functions
```

---

## Why this matters

Bad configs = bad AI output.

- ❌ Unpredictable code
- ❌ Ignored instructions
- ❌ Wasted tokens
- ❌ Hidden platform bugs

Good configs = controllable AI.

---

## Quick Start

Add to your MCP config:

```json
{
  "mcpServers": {
    "config-mode": {
      "command": "npx",
      "args": ["-y", "@serdaraytac/config-mode"]
    }
  }
}
```

Scan your project:

```
scan_project { "directory": "." }
```

Analyze & fix:

```
analyze_config  { "filepath": "./AGENTS.md" }
optimize_config { "filepath": "./AGENTS.md", "write": true }
```

**MCP config location by client:**

| Client | Config file |
|---|---|
| Claude Code | `~/.claude/claude_desktop_config.json` or `claude mcp add config-mode -- npx -y @serdaraytac/config-mode` |
| Cursor | `.cursor/mcp.json` or `~/.cursor/mcp.json` |
| Cline | VS Code settings → Cline MCP Servers |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |
| Gemini CLI | `~/.gemini/settings.json` under `mcpServers` |
| OpenCode | `opencode.json` under `"mcp"` key |

---

## Supported Platforms

Cursor · Codex · Copilot · Claude Code · Gemini CLI · Cline · Windsurf · OpenCode · Amp · Kimi · Warp · Antigravity · Firebender

---

## What it catches

- Vague rules ("best practices", "clean code")
- Silent truncation (Codex 32KB limit)
- Wrong frontmatter keys (Cursor vs Cline mismatch)
- Missing scope definitions
- Invalid imports (Gemini CLI)
- Duplicate or conflicting rules

### Platform-specific checks

Every check comes from official documentation — not guesswork.

**Claude Code**
- `CLAUDE_MISSING_BUILD_COMMANDS` — no build, test, or lint commands found; without them Claude discovers commands by reading `package.json` on every session (warning)
- `CLAUDE_COMMANDS_NOT_IN_BLOCK` — commands exist but are outside fenced code blocks; Claude Code parses fenced blocks for runnable commands
- `CLAUDE_PLACEHOLDER_FOUND` — unfilled `[TODO:]` markers left in production config; incomplete directives are worse than omission — the model cannot act on them (warning)
- `CLAUDE_IMPORT_IN_CODE_BLOCK` — `@`-imports inside fenced code blocks are treated as literal text, not resolved
- `CLAUDE_SUBDIR_SPLIT_RECOMMENDED` — file over 10 KB with no `@`-imports; Claude Code loads `CLAUDE.md` from every directory it navigates to — split into subdirectory files to reduce per-context token cost
- **Scorer:** missing build commands carries an extra coverage penalty — runnable commands are the highest-value addition to any `CLAUDE.md`
- **Optimizer:** adds `## Commands` section with a bash code block stub when commands are missing; flags unfilled `[TODO:]` placeholders with a count

**Cursor**
- `CURSOR_MISSING_FRONTMATTER` — `.cursor/rules/` files without YAML frontmatter lose scope control entirely; rule applies to nothing
- `CURSOR_CURSORRULES_LEGACY` — `.cursorrules` is no longer documented at cursor.com/docs; migrate to `.cursor/rules/*.md`
- `CURSOR_RULE_TOO_LONG` — files over 500 lines; Cursor docs recommend splitting into focused files
- `CURSOR_UNKNOWN_FRONTMATTER_KEY` — only `description`, `globs`, `alwaysApply` are recognized; unknown keys silently ignored
- **Optimizer:** auto-adds frontmatter stub with `description`, `globs`, `alwaysApply` fields

**Codex**
- `CODEX_SIZE_LIMIT` — hard 32 KiB truncation confirmed in [codex-rs source](https://github.com/openai/codex); content beyond it is silently dropped
- `CODEX_OVERRIDE_FILE_AVAILABLE` — `AGENTS.override.md` at the same directory takes precedence over `AGENTS.md` (shown for large files)
- **Scorer:** separate penalty for files approaching or exceeding the 32 KiB hard limit — silent truncation is more dangerous than verbosity

**GitHub Copilot**
- `COPILOT_WRONG_LOCATION` — `copilot-instructions.md` outside `.github/` is not recognized (critical)
- `COPILOT_INSTRUCTIONS_WRONG_EXTENSION` — files in `.github/instructions/` must end with `.instructions.md`
- `COPILOT_INSTRUCTIONS_MISSING_APPLY_TO` — path-specific instruction files without `applyTo:` apply repository-wide unintentionally
- `COPILOT_INVALID_EXCLUDE_AGENT` — `excludeAgent` only accepts `"code-review"` or `"cloud-agent"`
- **Optimizer:** auto-adds `applyTo:` frontmatter stub to path-specific files missing it

**Gemini CLI**
- `GEMINI_LARGE_NO_IMPORTS` — files over 10 KB with no `@`-imports; Gemini CLI supports `@./path.md` with up to 5 recursion levels
- `GEMINI_IMPORT_IN_CODE_BLOCK` — `@`-imports inside fenced code blocks are silently ignored
- `GEMINI_IMPORT_INVALID_PATH` — imports must use `@./`, `@../`, `@/`, or `@~/`; bare `@word` is not resolved
- **Optimizer:** fixes invalid `@path` → `@./path` automatically

**Cline**
- `CLINE_WRONG_FRONTMATTER_KEY` — Cline uses `paths:` for glob scoping, not `globs:` (Cursor's key); `globs:` is silently ignored
- `CLINE_UNSUPPORTED_EXTENSION` — only `.md` and `.txt` are processed from `.clinerules/`; others silently ignored
- `CLINE_EMPTY_PATHS` — `paths: []` means the rule never activates
- `CLINE_AT_IMPORT_NOT_SUPPORTED` — `@`-import syntax not supported; split rules into `.clinerules/` directory instead
- **Optimizer:** converts unstructured prose to bullet list format

**Amp**
- `AMP_INCORRECT_FILENAME` — `.amp/instructions.md` is not recognized; use `AGENTS.md` at project root
- `AMP_IMPORT_IMPLICIT_RECURSIVE` — paths without `./` or `../` prefix get `**/` prepended implicitly, matching files across the entire project
- `AMP_IMPORT_IN_CODE_BLOCK` — `@`-mentions inside fenced code blocks are silently ignored
- **Optimizer:** fixes bare `@path` → `@./path` to prevent unintended recursive matching

**OpenCode**
- `OPENCODE_PREFERS_AGENTS_MD` — `CLAUDE.md` works as a fallback but `AGENTS.md` is the preferred filename
- `OPENCODE_AT_IMPORT_NOT_SUPPORTED` — `@`-import syntax not supported; use the `"instructions"` field in `opencode.json` instead

### Vagueness detection

7 linguistic categories, each with its own penalty weight:

| Category | Penalty | Example |
|---|---|---|
| `false-shared-context` | −7 | "follow best practices", "industry standard" |
| `outcome-without-criterion` | −6 | "ensure quality", "handle errors properly" |
| `unmeasurable-quality` | −5 | "elegant", "robust", "well-written" |
| `passive-voice` | −5 | "errors should be handled", "tests need to be written" |
| `comparative-without-baseline` | −4 | "as simple as possible", "improve performance" |
| `vague-condition` | −3 | "when necessary", "in most cases", "for large files" |
| `weak-obligation` | −2 | "try to", "ideally", "consider using" |

The optimizer doesn't just flag — it rewrites:

| Before | After |
|---|---|
| `follow best practices` | `follow the conventions defined in this file` |
| `ensure quality` | `verify quality via tests and linting` |
| `errors should be handled` | `must [TODO: specify who performs this action and how]` |
| `try to write tests` | `[TODO: use 'always' if required, or remove if optional]` |
| `in most cases prefer X` | `always prefer X, except when [TODO: list the explicit exceptions]` |
| `for large files` | `for files exceeding [TODO: specify a threshold, e.g. 300 lines]` |

`[TODO: ...]` markers are inserted where the correct fix depends on project-specific context the tool cannot infer automatically.

---

## How it works

config-mode combines:

- Linguistic analysis (7 vagueness categories)
- Platform-specific validation rules
- Token-aware optimization
- Auto-rewriting engine

### Scoring

| Category | Max | What it measures |
|---|---|---|
| **Clarity** | 25 | Absence of vague directives; penalties scaled by platform sensitivity |
| **Structure** | 25 | Heading usage, section organization, platform-specific format compliance |
| **Token Efficiency** | 25 | File size vs. platform context window; hard-limit awareness |
| **Coverage** | 25 | Expected sections present; critical rules at head/tail |

| Score | Grade | |
|---|---|---|
| 90–100 | A | Production-ready |
| 75–89 | B | Minor improvements available |
| 60–74 | C | Multiple vague or missing sections |
| 40–59 | D | Significant clarity or structure problems |
| 0–39 | F | Major overhaul needed |

**Sensitivity** multiplies vagueness penalties per platform. Codex (1.3×) and Cursor/Copilot (1.2×) score stricter — GPT-4.1 follows instructions more literally, so the same vague rule causes more damage there.

Token efficiency penalizes both extremes. Thresholds scale with the platform's context window: a 4,000-token config is fine for Gemini CLI (1M tokens), but triggers a warning on OpenCode (131k). Codex gets an additional penalty for approaching its hard 32 KiB truncation limit.

### Tools

```
scan_project    →  find all config files in the repo
analyze_config  →  score each file, see what's wrong
optimize_config →  fix issues automatically, write back to disk
```

`scan_project` finds files inside `.cursor/rules/`, `.clinerules/`, `.github/instructions/`, `.gemini/`, `.warp/`, `.amp/`, and `.antigravity/` — not just root-level files.

`analyze_config` accepts a filepath or inline content:

```json
{ "filename": ".clinerules", "content": "# Rules\n..." }
```

`optimize_config` returns the fixed content with a before/after score. Add `"write": true` to save to disk.

---

## Try it

Run `analyze_config` on your config:

```
analyze_config { "filepath": "./CLAUDE.md" }
```

```json
{
  "platform": "claude",
  "score": {
    "overall": 62,
    "grade": "C",
    "categories": {
      "clarity": 13,
      "structure": 20,
      "tokenEfficiency": 22,
      "coverage": 7
    }
  },
  "issues": [
    { "code": "VAGUE_RULE",       "severity": "warning", "message": "[false-shared-context] 'Best practices' is undefined — LLM fills the gap with its own assumptions", "line": 4 },
    { "code": "VAGUE_RULE",       "severity": "warning", "message": "[weak-obligation] 'Try to keep functions small' — use 'always' or remove", "line": 9 },
    { "code": "MISSING_SECTION",  "severity": "info",    "message": "Missing expected sections for Claude Code: commands, architecture" }
  ]
}
```

Then `optimize_config` to fix it automatically.

---

## Roadmap

- GitHub Actions integration
- VS Code extension
- Multi-file rule conflict detection
- Custom scoring weights

---

## License

Elastic License 2.0
