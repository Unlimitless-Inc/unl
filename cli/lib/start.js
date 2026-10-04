"use strict";
/*
 * `unl` on its own — the starter. Neil: "in terminal for claude i just write claude,
 * i want to just write unl, do an oauth the way it works with claude and off we go."
 *
 * Bare `unl` signs in the first time (the same browser sign-in init uses) and opens the full-screen
 * terminal; with a key it opens straight in. Signing in never touches the current folder: wiring a
 * project stays `unl init`'s job, and the starter only offers it, in one quiet line.
 *
 * Everything here that decides what to print is pure, so the harness proves it without a network,
 * a browser or a terminal.
 */
const fs = require("fs");
const path = require("path");

const PKG_JSON = path.join(__dirname, "..", "package.json");

function version() {
  try {
    return JSON.parse(fs.readFileSync(PKG_JSON, "utf8")).version || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * The command a person should type next, as they actually reached this one. Installed with
 * `npm install -g unlimitless` it is `unl`; run through npx it is `npx unlimitless`, because `unl`
 * is not on their PATH and a line telling them to type it would be a dead end. Pure.
 */
function selfCommand(dir = __dirname, env = process.env) {
  const viaNpx = dir.split(path.sep).includes("_npx") || env.npm_command === "exec";
  return viaNpx ? "npx unlimitless" : "unl";
}

/** The short help, Claude Code style. Pure. */
function helpText(self = "unl") {
  const pad = (s) => s.padEnd(self.length + 16);
  return [
    "Unl brings your decisions, with their reasons, to the AI you work in.",
    "",
    `Usage: ${self} [command]`,
    "",
    `  ${pad(self)}Open the Unl terminal. The first time, it signs you in.`,
    `  ${pad(`${self} init`)}Add Unl to Claude Code in this project (--cursor for Cursor).`,
    `  ${pad(`${self} login`)}Sign in on this machine.`,
    `  ${pad(`${self} logout`)}Remove this machine's key.`,
    `  ${pad(`${self} status`)}What is installed here.`,
    `  ${pad(`${self} --version`)}Print the version.`,
    "",
    `init also takes --dry-run (show what it would change), --repair (update Unl's own entries in place),`,
    `--yes, --no-import and --from <where you came from>. It never adds Unl a second time.`,
    "",
    "More: unlimitless.ai/developers",
  ].join("\n");
}

/** The line an unknown command gets: what went wrong, then the short help. Never a stack trace. Pure. */
function unknownText(cmd, self = "unl") {
  return `${self}: there is no command "${cmd}".\n\n${helpText(self)}`;
}

/**
 * The header a first run opens with: Unl's mark, then one
 * plain line. `mode` is tui.js's colour mode; plain prints no escapes. Pure.
 */
function headerText(paint, ver) {
  return `\n ${paint.mark(" Unl ")} ${paint.dim(`v${ver}`)}\n\n ${paint.bold("Your decisions, with their reasons, in the AI you work in.")}\n`;
}

/** Files that mark a folder as a project someone works in. */
const PROJECT_MARKERS = [".git", "package.json", "pyproject.toml", "Cargo.toml", "go.mod", "Gemfile", "pom.xml", "build.gradle", "CLAUDE.md", "AGENTS.md"];

/**
 * Does this folder look like a project that is not wired to Unl yet? Only then does the starter offer
 * `init`, once, in one line. The home directory is never a project, whatever it holds. Pure over fs.
 */
function unwiredProject(dir, { home, exists = fs.existsSync, read = (f) => fs.readFileSync(f, "utf8") } = {}) {
  if (home && path.resolve(dir) === path.resolve(home)) return false;
  if (!PROJECT_MARKERS.some((m) => exists(path.join(dir, m)))) return false;
  // Wired means a Unl hook is already there: the one init installs, or a hand-wired one of Unl's own.
  for (const f of [".claude/settings.local.json", ".claude/settings.json", ".cursor/hooks.json"].map((f) => path.join(dir, ...f.split("/")))) {
    try {
      // Either slash: on Windows the path is written with backslashes.
      if (/\.unl[\\/]+hook\.cjs|unl-inject/.test(read(f))) return false;
    } catch {}
  }
  return true;
}

/** The quiet offer, when the folder is a project Unl is not wired into. Pure. */
function initOffer(self = "unl") {
  return `This folder is not wired to Unl yet. Run \`${self} init\` here to add Unl to Claude Code.`;
}

/**
 * Is a stored key still good? Three answers, never two: "ok", "refused" (the server said no, so sign in
 * again), or "unreachable" (no answer at all, so open the terminal anyway and let it reconnect, rather
 * than send someone who is offline through a sign-in that cannot work either).
 */
async function keyState(api, key, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(`${api}/api/wake`, { headers: { authorization: `Bearer ${key}`, "user-agent": "unl-cli/0.3" } });
    if (res.ok) return "ok";
    // Only a 401 means the key itself is refused. A 403 is a workspace the server will not serve,
    // which a fresh sign-in into the same workspace cannot change.
    return res.status === 401 ? "refused" : "unreachable";
  } catch {
    return "unreachable";
  }
}

module.exports = { version, selfCommand, helpText, unknownText, headerText, unwiredProject, initOffer, keyState, PROJECT_MARKERS };
