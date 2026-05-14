#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readFile, writeFile, readdir } from "fs/promises";
import { resolve, basename } from "path";
import { parseConfig } from "./parser.js";
import { analyze } from "./analyzer.js";
import { score } from "./scorer.js";
import { optimize } from "./optimizer.js";
import { getProfile } from "./platforms.js";

// Root-level config filenames (case-insensitive match).
const ROOT_CONFIG_FILES = new Set([
  "claude.md",
  "claude.local.md",
  ".cursorrules",
  "cursor.md",
  ".clinerules",
  "cline.md",
  "codex.md",
  "agents.md",
  "agent.md",
  "gemini.md",
  "copilot-instructions.md",
  ".windsurfrules",
  "windsurf.md",
  "opencode.md",
  "kimi.md",
  "warp.md",
  "firebender.xml",
]);

// Subdirectory config files: [subdir, filename] pairs — single known filename per dir.
const SUBDIR_CONFIG_FILES: Array<[string, string]> = [
  [".github",      "copilot-instructions.md"],
  [".gemini",      "GEMINI.md"],
  [".amp",         "instructions.md"],
  [".antigravity", "instructions.md"],
  [".warp",        "instructions.md"],
];

// Wildcard directories — every file inside is a potential config; platform detected per file.
// Supports .cursor/rules/*.md, .clinerules/*.md|txt, .github/instructions/*.instructions.md
const WILDCARD_DIRS = [
  ".cursor/rules",
  ".clinerules",
  ".github/instructions",
];

const server = new Server(
  { name: "config-mode", version: "1.0.3" },
  { capabilities: { tools: {} } }
);

async function resolveInput(args: Record<string, unknown>): Promise<
  { filename: string; content: string } | { error: string }
> {
  if (typeof args.filepath === "string") {
    const abs = resolve(args.filepath);
    try {
      const content = await readFile(abs, "utf-8");
      return { filename: basename(abs), content };
    } catch {
      return { error: `Cannot read file: ${abs}` };
    }
  }

  if (typeof args.filename === "string" && typeof args.content === "string") {
    return { filename: args.filename, content: args.content };
  }

  return { error: "Provide either filepath or both filename and content" };
}

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "analyze_config",
      description:
        "Analyze an AI coding agent config file and return a score with categorized issues. " +
        "Supports 14 platforms: Claude Code, Cursor, Cline, Codex, Gemini CLI, GitHub Copilot, " +
        "Windsurf, Amp, OpenCode, Warp, Kimi, Antigravity, Firebender, and unknown platforms. " +
        "Pass filepath to read from disk, or filename + content to pass inline.",
      inputSchema: {
        type: "object",
        properties: {
          filepath: {
            type: "string",
            description: "Absolute or relative path to the config file on disk",
          },
          filename: {
            type: "string",
            description: "Config filename when passing content inline (e.g. .cursorrules, AGENTS.md, .clinerules, GEMINI.md)",
          },
          content: {
            type: "string",
            description: "Full text content of the config file (used with filename)",
          },
        },
      },
    },
    {
      name: "optimize_config",
      description:
        "Analyze an AI coding agent config file and return an optimized version with a before/after score. " +
        "Replaces vague directives with concrete alternatives, removes duplicates, fixes passive voice, " +
        "weak obligations, false shared context, and other clarity issues. " +
        "Set write: true to save the optimized content back to filepath.",
      inputSchema: {
        type: "object",
        properties: {
          filepath: {
            type: "string",
            description: "Absolute or relative path to the config file on disk",
          },
          filename: {
            type: "string",
            description: "Config filename when passing content inline",
          },
          content: {
            type: "string",
            description: "Full text content of the config file (used with filename)",
          },
          write: {
            type: "boolean",
            description: "Write the optimized content back to filepath (requires filepath)",
          },
        },
      },
    },
    {
      name: "scan_project",
      description:
        "Scan a project directory and return all recognized AI coding agent config files found, " +
        "including files in subdirectories (.cursor/rules, .clinerules, .github/instructions, .github, .gemini, .amp, .antigravity, .warp).",
      inputSchema: {
        type: "object",
        properties: {
          directory: {
            type: "string",
            description: "Path to the project root directory to scan",
          },
        },
        required: ["directory"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const safeArgs = (args ?? {}) as Record<string, unknown>;

  // ── scan_project ────────────────────────────────────────────────────────────
  if (name === "scan_project") {
    if (typeof safeArgs.directory !== "string") {
      return {
        content: [{ type: "text", text: "Error: directory is required" }],
        isError: true,
      };
    }

    const dir = resolve(safeArgs.directory);
    try {
      const found: Array<{ filepath: string; filename: string; platform: string }> = [];

      // Root-level files
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (ROOT_CONFIG_FILES.has(entry.name.toLowerCase())) {
          const filepath = resolve(dir, entry.name);
          const cfg = parseConfig(entry.name, "");
          found.push({ filepath, filename: entry.name, platform: cfg.platform });
        }
      }

      // Subdirectory files — single known filename per directory
      for (const [subdir, filename] of SUBDIR_CONFIG_FILES) {
        const subdirPath = resolve(dir, subdir);
        try {
          const subdirEntries = await readdir(subdirPath, { withFileTypes: true });
          for (const entry of subdirEntries) {
            if (entry.isFile() && entry.name.toLowerCase() === filename.toLowerCase()) {
              const filepath = resolve(subdirPath, entry.name);
              const relname = `${subdir}/${entry.name}`;
              const cfg = parseConfig(relname, "");
              found.push({ filepath, filename: relname, platform: cfg.platform });
            }
          }
        } catch {
          // Subdirectory doesn't exist — skip silently
        }
      }

      // Wildcard directories — every file is a potential config (Cursor rules, Cline rules, Copilot instructions)
      for (const wildcardDir of WILDCARD_DIRS) {
        const wildcardPath = resolve(dir, wildcardDir);
        try {
          const wildcardEntries = await readdir(wildcardPath, { withFileTypes: true });
          for (const entry of wildcardEntries) {
            if (!entry.isFile()) continue;
            const relname = `${wildcardDir}/${entry.name}`;
            const cfg = parseConfig(relname, "");
            if (cfg.platform !== "unknown") {
              const filepath = resolve(wildcardPath, entry.name);
              found.push({ filepath, filename: relname, platform: cfg.platform });
            }
          }
        } catch {
          // Directory doesn't exist — skip silently
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ directory: dir, found, total: found.length }, null, 2),
          },
        ],
      };
    } catch {
      return {
        content: [{ type: "text", text: `Error: Cannot read directory: ${dir}` }],
        isError: true,
      };
    }
  }

  // ── analyze_config / optimize_config ────────────────────────────────────────
  const resolved = await resolveInput(safeArgs);
  if ("error" in resolved) {
    return {
      content: [{ type: "text", text: `Error: ${resolved.error}` }],
      isError: true,
    };
  }

  const config = parseConfig(resolved.filename, resolved.content);
  const analysis = analyze(config);
  const scoreResult = score(analysis);
  const profile = getProfile(config.platform);

  // Platform info block shared by both tools
  const platformInfo = {
    displayName:         profile.displayName,
    primaryModel:        profile.primaryModel,
    contextWindowTokens: profile.contextWindowTokens,
    vaguenessSensitivity: profile.vaguenessSensitivity,
    subscriptionBased:   profile.subscriptionBased,
  };

  // ── analyze_config ──────────────────────────────────────────────────────────
  if (name === "analyze_config") {
    const output = {
      platform:     config.platform,
      platformInfo,
      filename:     config.filename,
      score: {
        overall:    scoreResult.overall,
        grade:      scoreResult.grade,
        categories: scoreResult.categories,
      },
      tokenCount:       analysis.tokenCount,
      estimatedCostUsd: profile.subscriptionBased ? null : analysis.estimatedCostUsd,
      ...(profile.subscriptionBased && {
        costNote: "Subscription-based platform — per-session token cost not applicable",
      }),
      issues: analysis.issues.map((issue) => ({
        code:     issue.code,
        severity: issue.severity,
        message:  issue.message,
        ...(issue.line    !== undefined && { line:    issue.line }),
        ...(issue.context !== undefined && { context: issue.context }),
      })),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    };
  }

  // ── optimize_config ─────────────────────────────────────────────────────────
  if (name === "optimize_config") {
    const result = optimize(config, analysis, scoreResult);

    // Re-analyse the optimized content to show the after-score
    const optimizedConfig   = parseConfig(resolved.filename, result.optimizedContent);
    const optimizedAnalysis = analyze(optimizedConfig);
    const optimizedScore    = score(optimizedAnalysis);

    if (safeArgs.write === true) {
      if (typeof safeArgs.filepath !== "string") {
        return {
          content: [{ type: "text", text: "Error: write requires filepath to be specified" }],
          isError: true,
        };
      }
      const abs = resolve(safeArgs.filepath);
      try {
        await writeFile(abs, result.optimizedContent, "utf-8");
      } catch {
        return {
          content: [{ type: "text", text: `Error: Cannot write file: ${abs}` }],
          isError: true,
        };
      }
    }

    const output = {
      platform:     config.platform,
      platformInfo,
      filename:     config.filename,
      before: {
        overall: scoreResult.overall,
        grade:   scoreResult.grade,
        categories: scoreResult.categories,
      },
      after: {
        overall: optimizedScore.overall,
        grade:   optimizedScore.grade,
        categories: optimizedScore.categories,
      },
      scoreDelta:     optimizedScore.overall - scoreResult.overall,
      changesSummary: result.changesSummary,
      optimizedContent: result.optimizedContent,
      ...(safeArgs.write === true && { writtenTo: resolve(safeArgs.filepath as string) }),
    };

    return {
      content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
    };
  }

  return {
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
    isError: true,
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
