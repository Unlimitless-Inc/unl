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
 * CODEX, read at source in Codex's docs on 5 Oct (learn.chatgpt.com/codex/extend/mcp and
 * /docs/hooks). Everything goes in the USER config, ~/.codex/config.toml (or $CODEX_HOME/config.toml):
 *   - the server, signed in with Codex's own OAuth (`codex mcp login unl`), so no key is written into a file;
 *   - default_tools_approval_mode = "writes": Codex asks only for a tool not marked read-only, and Unl's three
 *     read tools are set to "approve" outright, so an agent does not stop on each read. Writes still carry
 *     their single-use nonce, and the shell sandbox is untouched;
 *   - the serve hook as inline [hooks] tables. The user layer needs no project trust, and the docs say layers
 *     merge rather than replace, so a tool that rewrites ~/.codex/hooks.json (Orca does) cannot drop it.
 * Codex still asks the person to approve a new hook once, in its /hooks review: that is Codex's trust step,
 * and init says so rather than going around it.
 */
const UNL_READ_TOOLS = ["connect_to_unl", "ask_unl", "get_from_unl"];

function codexHome(home, env = process.env) {
  return env.CODEX_HOME && env.CODEX_HOME.trim() ? env.CODEX_HOME.trim() : path.join(home, ".codex");
}

function readText(file) {
  try { return fs.readFileSync(file, "utf8"); } catch { return null; }
}

/** The [mcp_servers.<name>] tables in a config.toml's text that are Unl's, by name or by URL. Pure. */
function unlServersInToml(text, scope, where) {
  const out = [];
  const lines = String(text || "").split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*\[mcp_servers\.("?)([^\]".]+)\1\]\s*(#.*)?$/.exec(lines[i]);
    if (!m) continue;
    let body = "";
    for (let j = i + 1; j < lines.length && !/^\s*\[/.test(lines[j]); j++) body += lines[j] + "\n";
    if (isUnlServer(m[2], { body })) out.push({ name: m[2], scope, where });
  }
  return out;
}

/** Serve-hook commands anywhere in a TOML file's text (inline [hooks] tables, or a managed requirements file). Pure. */
function serveHooksInToml(text, file) {
  return String(text || "").split("\n").filter((l) => /^\s*command\s*=/.test(l) && SERVE_HOOK_RX.test(l)).map((l) => ({ file, event: "UserPromptSubmit", command: l.replace(/^\s*command\s*=\s*/, "").trim() }));
}

/**
 * What already wires Unl for Codex: servers in the user and project config.toml; serve hooks in either
 * config.toml, either hooks.json, and a managed requirements.toml (the house Mini's /etc/codex).
 */
function detectCodex(repo, { home, env = process.env, managed = "/etc/codex/requirements.toml" } = {}) {
  const ch = codexHome(home, env);
  const user = path.join(ch, "config.toml");
  const project = path.join(repo, ".codex", "config.toml");
  const hooks = [
    ...serveHooksIn(path.join(ch, "hooks.json"), ["UserPromptSubmit", "SessionStart"]),
    ...serveHooksIn(path.join(repo, ".codex", "hooks.json"), ["UserPromptSubmit", "SessionStart"]),
    ...serveHooksInToml(readText(user), user),
    ...serveHooksInToml(readText(project), project),
    ...(managed ? serveHooksInToml(readText(managed), managed) : []),
  ];
  const servers = [
    ...unlServersInToml(readText(user), "user", "~/.codex/config.toml"),
    ...unlServersInToml(readText(project), "project", ".codex/config.toml"),
  ];
  return { hooks, servers, unlMd: fs.existsSync(path.join(repo, "unl.md")), rules: rulesPointingAtUnlMd(repo) };
}

/** The TOML init appends for the server. JSON string syntax is valid TOML basic-string syntax. Pure. */
function codexServerToml(url) {
  const t = [
    "",
    "# Unl, added by `unlimitless init --codex`. Its read tools run without asking; anything else asks first.",
    `[mcp_servers.${MCP_NAME}]`,
    `url = ${JSON.stringify(url)}`,
    'default_tools_approval_mode = "writes"',
    // Codex hides MCP tools behind its tool search by default, so a fresh session never learns Unl is
    // there and makes no call unless the person names it.
    // Leaving the deferred surface out shows Unl's tools to the model up front, as Claude Code does.
    'omit_tools_from = ["deferred"]',
  ];
  for (const tool of UNL_READ_TOOLS) t.push("", `[mcp_servers.${MCP_NAME}.tools.${tool}]`, 'approval_mode = "approve"');
  return t.join("\n") + "\n";
}

/** The TOML init appends for the serve hook and its part 2 (one group, as in Claude Code). Pure. */
function codexHookToml(hookPath) {
  const cmd = commandPath(hookPath);
  return [
    "",
    "# Unl's per-turn serve, added by `unlimitless init --codex`. Codex asks you to approve it once, in /hooks.",
    "[[hooks.UserPromptSubmit]]",
    "",
    "[[hooks.UserPromptSubmit.hooks]]",
    'type = "command"',
    `command = ${JSON.stringify(`node "${cmd}"`)}`,
    "timeout = 15",
    "",
    "[[hooks.UserPromptSubmit.hooks]]",
    'type = "command"',
    `command = ${JSON.stringify(`node "${cmd}" more`)}`,
    "timeout = 30",
  ].join("\n") + "\n";
}

/**
 * Codex: append the server and the hook to the user config.toml, each only when asked for. A config that
 * already declares UserPromptSubmit some other way (an inline array, or a plain [hooks.UserPromptSubmit]
 * table) cannot take the appended array-of-tables, so the hook goes into ~/.codex/hooks.json instead, in
 * the shape Codex shares with Claude Code. Returns what it did, never a value.
 */
function wireCodex(home, { url, hookPath, skipMcp = false, skipHook = false, env = process.env } = {}) {
  const ch = codexHome(home, env);
  const file = path.join(ch, "config.toml");
  const before = readText(file) || "";
  let text = before;
  const mcpAdded = !skipMcp;
  if (mcpAdded) text += codexServerToml(url);
  let hookAdded = false;
  let hookFile = null;
  if (!skipHook) {
    const declared = /^\s*UserPromptSubmit\s*=|^\s*\[hooks\.UserPromptSubmit\]/m.test(before);
    if (!declared) {
      text += codexHookToml(hookPath);
      hookAdded = true;
      hookFile = file;
    } else {
      const hf = path.join(ch, "hooks.json");
      const settings = readJson(hf);
      const cmd = commandPath(hookPath);
      if (addHook(settings, "UserPromptSubmit", `node "${cmd}"`, (c) => isUnlHook(c, cmd) && !PART_TWO_RX.test(c))) {
        addPartTwo(settings, cmd);
        writeJson(hf, settings);
        hookAdded = true;
        hookFile = hf;
      }
    }
  }
  if (text !== before) {
    fs.mkdirSync(ch, { recursive: true });
    fs.writeFileSync(file, text.startsWith("\n") && !before ? text.slice(1) : text);
  }
  return { file, before, mcpAdded, hookAdded, hookFile };
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
const SERVE_HOOK_RX = /\.unl[\\/]+hook\.cjs|unl[-_]inject|unl-codex-serve|api\.unlimitless\.ai/i;
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

/**
 * What was found, in plain lines for the terminal. Names and places only, never a value. An identical line
 * is said once: a managed requirements file can list the same hook many times, and printing it ten times
 * reads as a fault. Pure.
 */
function describeFound(found, repo) {
  const rel = (f) => (f.startsWith(repo) ? path.relative(repo, f) : f.replace(require("os").homedir(), "~"));
  return [...new Set([
    ...found.hooks.map((h) => `hook in ${rel(h.file)} (${h.event})`),
    ...found.servers.map((s) => (s.where === "claude mcp list" ? `server "${s.name}" (${s.scope === "claude.ai connector" ? "a claude.ai connector" : "reported by claude mcp list"})` : `server "${s.name}" in ${s.scope} scope (${s.where})`)),
    ...(found.unlMd ? ["unl.md in this folder"] : []),
    ...found.rules.map((r) => `${r} points at unl.md`),
  ])];
}

/**
 * Not a project folder: the home folder or the filesystem root. Run there, the read step finds nothing and
 * unl.md would land in the home folder, so init says so instead. Pure but for path.
 */
function notAProject(dir, home) {
  // Real paths, because macOS hands out /var/… for /private/var/…: a resolved-only compare missed a home
  // folder reached through a symlink, measured on this change's own check.
  const real = (p) => { try { return fs.realpathSync(path.resolve(p)); } catch { return path.resolve(p); } };
  const d = real(dir);
  return d === real(home) || d === path.parse(d).root;
}

/**
 * The last line init prints for a surface, or null. Codex runs a new hook only after the person approves it
 * in /hooks, so that instruction is given only when this run added one: a hook already active (a managed
 * one, or an earlier run's) needs no approval, and telling him to approve it anyway was wrong. Pure.
 */
function closingLine(surface, { hookAdded }) {
  if (surface === "codex") return hookAdded ? "The first time, open Codex and type /hooks: Codex runs a new hook only after you approve it there, once." : null;
  if (surface === "claude-code") return "The first time, Claude Code asks whether you trust this folder. Say yes: the hook and the unl server only run in folders you trust.";
  return null;
}

/** unl.md at the repo root: reach and mechanics only; the decisions stay in Unl. */
function writeUnlMd(repo, templatePath) {
  const file = path.join(repo, "unl.md");
  if (fs.existsSync(file)) return false;
  fs.copyFileSync(templatePath, file);
  return true;
}

module.exports = { wireClaudeHook, wireClaudeMcp, wireCursor, wireCodex, detectCodex, codexHome, codexServerToml, codexHookToml, UNL_READ_TOOLS, writeUnlMd, addHook, isUnlHook, commandPath, MCP_NAME, detectClaude, detectCursor, planWiring, describeFound, notAProject, closingLine, unlServersFromList, SERVE_HOOK_RX };
