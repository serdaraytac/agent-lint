# agent-lint

An MCP tool that analyzes, scores, and optimizes AI coding agent config files — CLAUDE.md, .cursorrules, .clinerules, AGENTS.md, GEMINI.md, .windsurfrules, copilot-instructions.md, and more.

## What it does

- **Scores** your config file 0–100 across four dimensions: clarity, structure, token efficiency, and coverage
- **Detects vague rules** across 7 linguistic categories that LLMs cannot reliably act on
- **Replaces vague directives** with concrete, actionable alternatives — not just flags, but fixes
- **Estimates token cost** per session using platform-specific pricing; flags bloated or underspecified files
- **Calibrates scoring per platform** — GPT-4.1-based tools (Cursor, Codex, Copilot) score stricter because they follow instructions more literally
- **Checks attention placement** — critical rules should sit at the head or tail of the file (LLM U-shaped attention)
- **Finds duplicate content** that wastes context window budget
- **Suggests missing sections** based on the target platform's expected structure
- **Reports before/after scores** so you can see the impact of optimization

## Supported platforms

| Platform | Config file | Model | Sensitivity |
|---|---|---|---|
| Claude Code | `CLAUDE.md` | Claude Sonnet/Opus | 1.0× (baseline) |
| Cursor | `.cursorrules`, `.cursor/rules/*.md` | GPT-4o / Claude (auto) | 1.2× |
| Cline | `.clinerules` | Configurable | 1.0× |
| Codex | `AGENTS.md`, `codex.md` | codex-1 / GPT-4.1 | 1.3× |
| Gemini CLI | `GEMINI.md`, `.gemini/GEMINI.md` | Gemini 2.5 Pro | 1.0× |
| GitHub Copilot | `copilot-instructions.md` | GPT-4o | 1.2× |
| Windsurf | `.windsurfrules` | Claude Sonnet | 1.0× |
| Amp | `AGENTS.md` | Claude Opus 4.7 | 1.0× |
| OpenCode | `opencode.md` | Configurable | 1.1× |
| Warp | `.warp/instructions.md` | Configurable | 1.1× |
| Kimi Code CLI | `kimi.md` | Kimi K2 | 1.1× |
| Antigravity | `.antigravity/instructions.md` | Gemini-based | 1.0× |
| Firebender | `firebender.xml` | Unknown | 1.1× |
| Unknown | any | Unknown | 1.3× |

**Sensitivity** is a per-platform multiplier on vagueness penalties. Higher means the same vague rule costs more points — calibrated against [GPT-4.1 literal instruction-following research](https://developers.openai.com/cookbook/examples/gpt4-1_prompting_guide) and [AMBIG-SWE underspecification findings](https://arxiv.org/abs/2502.13069).

## Vagueness detection

The analyzer detects vague rules across **7 linguistic categories**, each with its own penalty weight:

| Category | Penalty | Examples |
|---|---|---|
| `false-shared-context` | −7 | "follow best practices", "use your judgment", "industry standard" |
| `outcome-without-criterion` | −6 | "ensure quality", "be thorough", "handle errors properly" |
| `unmeasurable-quality` | −5 | "elegant", "robust", "well-written", "high-quality" |
| `passive-voice` | −5 | "errors should be handled", "tests need to be written" |
| `comparative-without-baseline` | −4 | "as simple as possible", "improve performance", "cleaner solution" |
| `vague-condition` | −3 | "when necessary", "in most cases", "for large files", "in general" |
| `weak-obligation` | −2 | "try to", "ideally", "consider using", "it would be nice to" |

Penalty weights reflect research: `false-shared-context` and `outcome-without-criterion` are the most damaging because the model fills in missing information with its own assumptions (see [AMBIG-SWE](https://arxiv.org/abs/2502.13069)). `weak-obligation` is least harmful — the model likely complies anyway.

### What the optimizer does with each category

The optimizer does not just flag — it rewrites:

| Before | After |
|---|---|
| `follow best practices` | `follow the conventions defined in this file` |
| `ensure quality` | `verify quality via tests and linting` |
| `errors should be handled` | `must [TODO: specify who performs this action and how]` |
| `try to write tests` | `[TODO: use 'always' if required, or remove if optional]` |
| `as simple as possible` | `[TODO: specify a concrete target, e.g. under 50 lines]` |
| `in most cases prefer X` | `always prefer X, except when [TODO: list the explicit exceptions]` |
| `for large files` | `for files exceeding [TODO: specify a measurable threshold, e.g. 300 lines]` |

`[TODO: ...]` markers are inserted where the correct fix depends on project-specific context the tool cannot infer automatically.

## Installation

### Claude Code

```json
{
  "mcpServers": {
    "agent-lint": {
      "command": "npx",
      "args": ["-y", "@serdaraytac/agent-lint"]
    }
  }
}
```

### Cursor / Windsurf / other MCP clients

```json
{
  "mcpServers": {
    "agent-lint": {
      "command": "npx",
      "args": ["-y", "@serdaraytac/agent-lint"]
    }
  }
}
```

## Tools

### `analyze_config`

Analyze a config file and return a score with categorized issues.

```json
{ "filepath": "/path/to/CLAUDE.md" }
```

Or pass content inline:

```json
{ "filename": ".cursorrules", "content": "# Rules\n..." }
```

**Response:**

```json
{
  "platform": "cursor",
  "platformInfo": {
    "displayName": "Cursor",
    "primaryModel": "claude-sonnet / gpt-4o (auto)",
    "contextWindowTokens": 200000,
    "vaguenessSensitivity": 1.2,
    "subscriptionBased": false
  },
  "filename": ".cursorrules",
  "score": {
    "overall": 61,
    "grade": "C",
    "categories": {
      "clarity": 12,
      "structure": 20,
      "tokenEfficiency": 22,
      "coverage": 7
    }
  },
  "tokenCount": 430,
  "estimatedCostUsd": 0.000000538,
  "issues": [
    {
      "code": "VAGUE_RULE",
      "severity": "warning",
      "message": "[false-shared-context] \"Best practices\" is undefined — name the specific practices or link a reference",
      "line": 4,
      "context": "Follow best practices at all times."
    }
  ]
}
```

For subscription-based platforms (Copilot, Codex, Windsurf, Warp), `estimatedCostUsd` is `null` and a `costNote` field explains why.

### `optimize_config`

Return an optimized version of the config with a before/after score. Add `"write": true` to save back to disk.

```json
{ "filepath": "/path/to/CLAUDE.md", "write": true }
```

**Response:**

```json
{
  "platform": "claude",
  "platformInfo": {
    "displayName": "Claude Code",
    "vaguenessSensitivity": 1.0,
    "subscriptionBased": false
  },
  "before": { "overall": 48, "grade": "D" },
  "after":  { "overall": 71, "grade": "C" },
  "scoreDelta": 23,
  "changesSummary": [
    "Replaced 4 vague directive(s) with concrete alternatives",
    "Removed 1 duplicate line(s)",
    "Added stub sections: commands, architecture"
  ],
  "optimizedContent": "...",
  "writtenTo": "/path/to/CLAUDE.md"
}
```

### `scan_project`

Find all recognized config files in a project, including files in subdirectories (`.github`, `.gemini`, `.amp`, `.antigravity`, `.warp`).

```json
{ "directory": "/path/to/project" }
```

**Response:**

```json
{
  "directory": "/path/to/project",
  "total": 2,
  "found": [
    { "filepath": "/path/to/project/CLAUDE.md",      "filename": "CLAUDE.md",      "platform": "claude" },
    { "filepath": "/path/to/project/.cursorrules",    "filename": ".cursorrules",   "platform": "cursor" }
  ]
}
```

## Scoring

| Category | Max | What it measures |
|---|---|---|
| **Clarity** | 25 | Absence of vague directives across 7 categories; penalties scaled by platform sensitivity |
| **Structure** | 25 | Heading usage, section organization, line length |
| **Token Efficiency** | 25 | File size relative to platform context window; duplicate content |
| **Coverage** | 25 | Platform-expected sections present; critical rules at head/tail |

### Token efficiency calibration

Token efficiency is not "shorter is better." It penalizes both extremes:

- **< 50 tokens** — nearly empty, structurally useless (−10)
- **50–150 tokens** — likely underspecified (−3)
- **150–Nk tokens** — optimal range (no penalty)
- **> 2× threshold** — heavy, borderline (−7)
- **> 4× threshold** — bloated, costs attention and money (−15)

The upper threshold scales with the platform's context window. On Gemini CLI (1M tokens), a 4,000-token config is fine; on OpenCode (131k), the same file triggers a warning. Calibrated against [DETAIL: Measuring the Impact of Prompt Specificity](https://arxiv.org/abs/2512.02246), which found that specific prompts average 124 tokens while vague ones average 57 — confirming that short ≠ efficient.

## Grades

| Score | Grade | Meaning |
|---|---|---|
| 90–100 | A | Production-ready — no significant issues |
| 75–89 | B | Good — minor improvements available |
| 60–74 | C | Needs work — multiple vague or missing sections |
| 40–59 | D | Poor — significant clarity or structure problems |
| 0–39 | F | Major overhaul needed |

## Development

```bash
npm install
npm test          # run all tests (97 tests across 6 files)
npm run build     # compile to dist/
npm run dev       # run server directly with tsx (no build needed)
```

## License

[Elastic License 2.0](LICENSE) — free to use and self-host; you may not offer this software as a managed service.
