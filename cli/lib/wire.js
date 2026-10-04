"use strict";
/*
 * Wiring each surface. Every write here is to a PER-DEVELOPER file (never one a teammate would
 * pick up from the repo) and is idempotent: running init twice changes nothing the second time.
 */
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const MCP_NAME = "unl";

/**
 * Is this command (or this settings file's text) Unl's own hook? The file is
 * ~/.unl/hook.cjs, but on Windows that path is written with backslashes, doubled again inside JSON,
 * so a check for ".unl/hook.cjs" never matched there: init added the hook a second time on every run
 * and status said "not wired". Either slash, any number of them. Pure.
 */
const UNL_HOOK_RX = /\.unl[\\/]+hook\.cjs/;
/** The part-2 command, `node "…/hook.cjs" more`. */
const PART_TWO_RX = /hook\.cjs"?\s+more\s*$/;
const isUnlHook = (text, hookPath) => typeof text === "string" && (UNL_HOOK_RX.test(text) || (!!hookPath && text.includes(hookPath)));

/**
 * The path as a hook command names it: forward slashes on Windows too. Node takes C:/Users/…, and
 * Claude Code runs a hook command through a shell (Git Bash on Windows), where a backslash is an
 * escape; a forward-slash path means the same file in bash, cmd and PowerShell. Pure.
 */
const commandPath = (p, sep = path.sep) => (sep === "\\" ? p.split("\\").join("/") : p);

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") return {};
    throw new Error(`${file} is not valid JSON, so it was left untouched. Fix it and run init again.`);
  }
}
function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
}

/** Add one hook command under `event` unless a command already matches `marker` (a predicate). */
function addHook(settings, event, command, marker) {
  settings.hooks = settings.hooks || {};
  const groups = (settings.hooks[event] = settings.hooks[event] || []);
  const present = groups.some((g) => (g.hooks || []).some((h) => marker(h.command)));
  if (present) return false;
  groups.push({ hooks: [{ type: "command", command, timeout: 15 }] });
  return true;
}

/**
 * Part 2 rides in the SAME group as the serve (measured 28 Sep on Claude Code 2.1.283: two commands in one group
 * both run and each output arrives whole), so the settings keep one Unl entry. Added only beside init's own serve
 * hook, and only once. Returns whether it was added.
 */
function addPartTwo(settings, cmd) {
  const groups = (settings.hooks && settings.hooks.UserPromptSubmit) || [];
  if (groups.some((g) => (g.hooks || []).some((h) => isUnlHook(h.command, cmd) && PART_TWO_RX.test(String(h.command || ""))))) return false;
  const home = groups.find((g) => (g.hooks || []).some((h) => isUnlHook(h.command, cmd) && !PART_TWO_RX.test(String(h.command || ""))));
  if (!home) return false;
  home.hooks.push({ type: "command", command: `node "${cmd}" more`, timeout: 30 });
  return true;
}

/** Claude Code: the enforcing UserPromptSubmit hook, in .claude/settings.local.json. */
function wireClaudeHook(repo, hookPath) {
  const file = path.join(repo, ".claude", "settings.local.json");
  const settings = readJson(file);
  const cmd = commandPath(hookPath);
  // Two commands: the serve, and its part 2 for a turn that keeps more than one hook output
  // can carry whole. Each is recognised as itself, so neither is ever taken for the other or added twice.
  const main = addHook(settings, "UserPromptSubmit", `node "${cmd}"`, (c) => isUnlHook(c, cmd) && !PART_TWO_RX.test(c));
  // Only beside a serve hook added in this same call: init never touches a folder already wired.
  const more = main ? addPartTwo(settings, cmd) : false;
  const added = main || more;
  if (added) writeJson(file, settings);
  return { file: path.relative(repo, file), added };
}

function claude(args, opts = {}) {
  return spawnSync(opts.bin || "claude", args, { cwd: opts.cwd, encoding: "utf8", timeout: 60000 });
}

/**
 * Claude Code: the MCP server, local scope (this project, this developer), authenticated by the
 * headersHelper so the key never enters argv or a project file. An existing local `unl` entry is
 * replaced ONLY on --repair: init detects every Unl server first (detectClaude)
 * and never adds a second, so a plain run reaches here only when there is none.
 */
function wireClaudeMcp(repo, { url, headersPath, bin, replace = false }) {
  const probe = claude(["--version"], { cwd: repo, bin });
  if (probe.error || probe.status !== 0) return { ok: false, reason: "Claude Code's `claude` command is not on your PATH" };
  const existing = claude(["mcp", "get", MCP_NAME], { cwd: repo, bin });
  if (existing.status === 0 && !replace) return { ok: true, replaced: false, kept: true };
  if (existing.status === 0) claude(["mcp", "remove", MCP_NAME, "-s", "local"], { cwd: repo, bin });
  const config = JSON.stringify({ type: "http", url, headersHelper: `node "${commandPath(headersPath)}"` });
  const add = claude(["mcp", "add-json", MCP_NAME, config, "-s", "local"], { cwd: repo, bin });
  if (add.status !== 0) {
    const why = `${add.stderr || add.stdout || ""}`.trim().split("\n").pop();
    return { ok: false, reason: why || "claude mcp add-json failed" };
  }
  return { ok: true, replaced: existing.status === 0 };
}

/**
 * Cursor: the MCP server in .cursor/mcp.json (URL only; Cursor signs in over OAuth itself, and no
 * key is written into a project file) and the sessionStart hook in .cursor/hooks.json, the seam
 * Cursor delivers context through.
 */
function wireCursor(repo, { url, hookPath, skipMcp = false, skipHook = false }) {
  const mcpFile = path.join(repo, ".cursor", "mcp.json");
  const mcp = readJson(mcpFile);
  mcp.mcpServers = mcp.mcpServers || {};
  const mcpAdded = !skipMcp && !mcp.mcpServers[MCP_NAME];
  if (mcpAdded) {
    mcp.mcpServers[MCP_NAME] = { url };
    writeJson(mcpFile, mcp);
  }
  const hooksFile = path.join(repo, ".cursor", "hooks.json");
  const hooks = readJson(hooksFile);
  hooks.version = hooks.version || 1;
  hooks.hooks = hooks.hooks || {};
  const list = (hooks.hooks.sessionStart = hooks.hooks.sessionStart || []);
  const cmd = commandPath(hookPath);
  const hookAdded = !skipHook && !list.some((h) => isUnlHook(h.command, cmd));
  if (hookAdded) {
    list.push({ command: `node "${cmd}" cursor-start` });
    writeJson(hooksFile, hooks);
  }
  return { mcpAdded, hookAdded };
}

/*
 * NEVER DOUBLE-WIRE. Init used to recognise only its OWN hook (~/.unl/hook.cjs) and a
 * server named exactly "unl", so a folder already reaching Unl another way got a second of each. Neil ran
 * init in a repo whose seats already had a serve hook (.claude/hooks/unl-inject.sh) and the Unl server,
 * and init added a second hook and a second server: every turn's serve, twice. So before anything is
 * written, look everywhere a Unl hook or server can already live, whatever it is called, and add only
 * what is genuinely missing. Everything here READS; nothing is written, and no value is printed.
 */

/** A hook command that serves Unl: init's own runtime, the repo-style serve hook, or anything calling Unl's API. */
const SERVE_HOOK_RX = /\.unl[\\/]+hook\.cjs|unl[-_]inject|api\.unlimitless\.ai/i;
/** A server is Unl's when it points at Unl's API, or carries Unl's name (a stdio dev server, a connector). */
const UNL_URL_RX = /api\.unlimitless\.ai/i;
const UNL_NAME_RX = /^(claude\.ai[\s_-]+)?(unl|unlimitless)$/i;
const isUnlServer = (name, cfg) => UNL_NAME_RX.test(String(name || "").trim()) || UNL_URL_RX.test(JSON.stringify(cfg || {}));

function readJsonQuiet(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

/** Serve hooks in one settings file, under the events that inject context. Pure over the file's text. */
function serveHooksIn(file, events) {
  const j = readJsonQuiet(file);
  const out = [];
  for (const ev of events) {
    for (const g of (j && j.hooks && j.hooks[ev]) || []) {
      // Claude Code nests { hooks: [{ command }] }; Cursor lists { command } directly.
      for (const h of (g && g.hooks) || [g]) if (h && SERVE_HOOK_RX.test(String(h.command || ""))) out.push({ file, event: ev, command: String(h.command) });
    }
  }
  return out;
}

function unlServersIn(obj, scope, where) {
  return Object.entries((obj && obj.mcpServers) || {}).filter(([n, c]) => isUnlServer(n, c)).map(([name, cfg]) => ({ name, scope, where, ours: !!(cfg && cfg.headersHelper && /\.unl[\\/]+headers/.test(String(cfg.headersHelper))) }));
}

/** Connectors and servers as `claude mcp list` reports them ("<name>: <target> - <state>"). Pure. */
function unlServersFromList(text) {
  const out = [];
  for (const line of String(text || "").split("\n")) {
    const m = /^(.+?):\s+(\S+).*\s-\s/.exec(line.trim());
    if (m && isUnlServer(m[1], { url: m[2] })) out.push({ name: m[1].trim(), scope: /^claude\.ai\s/i.test(m[1]) ? "claude.ai connector" : "listed by claude", where: "claude mcp list" });
  }
  return out;
}

/** Rules files that already point an agent at unl.md. */
function rulesPointingAtUnlMd(repo) {
  return ["CLAUDE.md", "AGENTS.md", ".cursorrules"].map((f) => path.join(repo, f)).filter((f) => {
    try { return /\bunl\.md\b/.test(fs.readFileSync(f, "utf8")); } catch { return false; }
  }).map((f) => path.relative(repo, f));
}

/**
 * What already wires Unl for Claude Code here, in every scope: serve hooks in the project, local and user
 * settings; Unl servers in .mcp.json (project), ~/.claude.json (user, and this folder's local scope) and,
 * when `listText` is given, whatever `claude mcp list` shows (a claude.ai connector included). Duplicates
 * across sources are folded by name.
 */
function detectClaude(repo, { home, listText } = {}) {
  const hooks = [
    path.join(repo, ".claude", "settings.json"),
    path.join(repo, ".claude", "settings.local.json"),
    path.join(home, ".claude", "settings.json"),
  ].flatMap((f) => serveHooksIn(f, ["UserPromptSubmit", "SessionStart"]));
  const cfg = readJsonQuiet(path.join(home, ".claude.json")) || {};
  const local = (cfg.projects && (cfg.projects[repo] || cfg.projects[safeReal(repo)])) || {};
  const servers = [
    ...unlServersIn(readJsonQuiet(path.join(repo, ".mcp.json")), "project", ".mcp.json"),
    ...unlServersIn(cfg, "user", "~/.claude.json"),
    ...unlServersIn(local, "local", "~/.claude.json (this folder)"),
  ];
  for (const s of unlServersFromList(listText)) if (!servers.some((x) => x.name === s.name)) servers.push(s);
  return { hooks, servers, unlMd: fs.existsSync(path.join(repo, "unl.md")), rules: rulesPointingAtUnlMd(repo) };
}

function safeReal(p) { try { return fs.realpathSync.native(p); } catch { return p; } }

/** The same for Cursor: the project and user mcp.json and hooks.json. */
function detectCursor(repo, { home } = {}) {
  const hooks = [path.join(repo, ".cursor", "hooks.json"), path.join(home, ".cursor", "hooks.json")].flatMap((f) => serveHooksIn(f, ["sessionStart"]));
  const servers = [
    ...unlServersIn(readJsonQuiet(path.join(repo, ".cursor", "mcp.json")), "project", ".cursor/mcp.json"),
    ...unlServersIn(readJsonQuiet(path.join(home, ".cursor", "mcp.json")), "user", "~/.cursor/mcp.json"),
  ];
  return { hooks, servers, unlMd: fs.existsSync(path.join(repo, "unl.md")), rules: rulesPointingAtUnlMd(repo) };
}

/**
 * The plan: add only what is missing. A hook is added when no serve hook exists in any scope; a server
 * when no Unl server exists in any scope, under any name. --repair may replace init's OWN local "unl"
 * server in place (the OAuth form swapped for the key form) and nothing else. Pure.
 */
function planWiring(found, { repair = false } = {}) {
  const ownLocalOnly = found.servers.length > 0 && found.servers.every((s) => s.scope === "local" && s.name === MCP_NAME);
  return {
    addHook: found.hooks.length === 0,
    addServer: found.servers.length === 0,
    replaceServer: repair && ownLocalOnly,
    writeUnlMd: !found.unlMd,
    alreadyWired: found.hooks.length > 0 || found.servers.length > 0,
  };
}

/** What was found, in plain lines for the terminal. Names and places only, never a value. Pure. */
function describeFound(found, repo) {
  const rel = (f) => (f.startsWith(repo) ? path.relative(repo, f) : f.replace(require("os").homedir(), "~"));
  return [
    ...found.hooks.map((h) => `hook in ${rel(h.file)} (${h.event})`),
    ...found.servers.map((s) => (s.where === "claude mcp list" ? `server "${s.name}" (${s.scope === "claude.ai connector" ? "a claude.ai connector" : "reported by claude mcp list"})` : `server "${s.name}" in ${s.scope} scope (${s.where})`)),
    ...(found.unlMd ? ["unl.md in this folder"] : []),
    ...found.rules.map((r) => `${r} points at unl.md`),
  ];
}

/** unl.md at the repo root: reach and mechanics only; the decisions stay in Unl. */
function writeUnlMd(repo, templatePath) {
  const file = path.join(repo, "unl.md");
  if (fs.existsSync(file)) return false;
  fs.copyFileSync(templatePath, file);
  return true;
}

module.exports = { wireClaudeHook, wireClaudeMcp, wireCursor, writeUnlMd, addHook, isUnlHook, commandPath, MCP_NAME, detectClaude, detectCursor, planWiring, describeFound, unlServersFromList, SERVE_HOOK_RX };
