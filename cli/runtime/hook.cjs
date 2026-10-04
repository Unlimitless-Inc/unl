#!/usr/bin/env node
/*
 * The Unl hook, as `npx unlimitless init` installs it at ~/.unl/hook.cjs.
 *
 * WHAT IT IS. The stranger's copy of the house hook (.claude/hooks/unl-inject.sh + its renderer):
 * the same request, the same rendering, the same failure lines, in one dependency-free Node file
 * because a fresh machine that can run `npx` has Node and may not have python3.
 *
 *   node hook.cjs              Claude Code UserPromptSubmit — every turn, the person's own turn is
 *                              sent VERBATIM to /api/ask; the governing window comes back as
 *                              context for the agent. Silent when nothing bears (the server says so).
 *   node hook.cjs more         Claude Code UserPromptSubmit, PART 2: Claude Code caps each hook
 *                              output at 10,000 characters and carries every hook's output, so when a turn
 *                              keeps more decisions than part 1 can carry whole, this second hook prints
 *                              the rest, each in full. Nothing otherwise. It never calls the connector.
 *   node hook.cjs cursor-start Cursor sessionStart — once per session, the wake as
 *                              additional_context (Cursor delivers context at session start, not
 *                              per turn; nothing here pretends otherwise).
 *
 * THE THREE STATES, kept apart on purpose: success is silent to the person; no key is
 * silent (not set up is not broken); a reach that FAILED is said, every turn, on the person's
 * channel — a coder told they are governed must never be silently ungoverned.
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");

const HOME = process.env.UNL_HOME || path.join(os.homedir(), ".unl");
const BASE = (process.env.UNL_ASK_URL || "https://api.unlimitless.ai").replace(/\/+$/, "");
const TIMEOUT_MS = Math.max(1000, Number(process.env.UNL_ASK_TIMEOUT || 5) * 1000);

// ── PART 2 OF THE SERVE ──────────
// Both hooks read the same turn, so they meet at files keyed by its session and prompt: <key>.run (part 1 is
// serving), <key>.listen (part 2 is here), <key>.part2 (its text, written atomically), <key>.done (part 1 exited,
// on every path). Part 1 uses the split only when part 2 is listening, and names every part-2 decision with its
// pointer anyway, so a part 2 that never arrives costs nothing.
const crypto = require("crypto");
const PART_WAIT_MS = 25_000;
const PART_START_MS = 3_000;
function partsBase(d) {
  const sid = typeof d.session_id === "string" ? d.session_id.trim() : "";
  const prompt = typeof d.prompt === "string" ? d.prompt : "";
  if (!sid || !prompt.trim()) return "";
  try {
    const dir = process.env.UNL_PARTS_DIR || path.join(os.tmpdir(), "unl-hook-parts");
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    const now = Date.now();
    for (const f of fs.readdirSync(dir)) {
      try { if (now - fs.statSync(path.join(dir, f)).mtimeMs > 3_600_000) fs.unlinkSync(path.join(dir, f)); } catch {}
    }
    return path.join(dir, crypto.createHash("sha256").update(sid + "\0" + prompt).digest("hex").slice(0, 24));
  } catch {
    return "";
  }
}
const touch = (f) => { try { fs.writeFileSync(f, ""); } catch {} };
function writePart2(file, text) {
  fs.writeFileSync(file + ".tmp", text);
  fs.renameSync(file + ".tmp", file);
}

async function partTwo() {
  let d;
  try { d = JSON.parse(await readStdin()); } catch { return; }
  const base = partsBase(d);
  if (!base) return;
  touch(base + ".listen");
  const t0 = Date.now();
  try {
    while (Date.now() - t0 < PART_WAIT_MS) {
      if (fs.existsSync(base + ".part2")) {
        const text = fs.readFileSync(base + ".part2", "utf8").trim();
        if (text) process.stdout.write(text + "\n");
        return;
      }
      if (fs.existsSync(base + ".done")) return;
      if (!fs.existsSync(base + ".run") && Date.now() - t0 > PART_START_MS) return;
      await new Promise((r) => setTimeout(r, 50));
    }
  } finally {
    for (const ext of ["run", "listen", "part2", "done"]) { try { fs.unlinkSync(`${base}.${ext}`); } catch {} }
  }
}

function readKey() {
  if (process.env.UNL_ASK_KEY && process.env.UNL_ASK_KEY.trim()) return process.env.UNL_ASK_KEY.trim();
  try {
    return fs.readFileSync(path.join(HOME, "reach-key"), "utf8").trim();
  } catch {
    return "";
  }
}

// WHICH WORLD: with nothing
// declared, Agent Unl reads a turn that names no project from where the session is working. Only the folder's
// own name and, for a git checkout, the repository's owner/name leave the machine, never its URL or a path
// above the folder. The server reads them only when the turn itself is silent.
function surfaceWorld(cwd) {
  const out = {};
  const dir = typeof cwd === "string" ? cwd.trim().replace(/\/+$/, "") : "";
  if (!dir) return out;
  out.folder = path.basename(dir).slice(0, 120);
  try {
    const url = require("child_process").execFileSync("git", ["-C", dir, "config", "--get", "remote.origin.url"], { encoding: "utf8", timeout: 1000, stdio: ["ignore", "pipe", "ignore"] }).trim();
    const m = url.match(/[:/]([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
    if (m) out.repo = `${m[1]}/${m[2]}`.toLowerCase();
  } catch {}
  return out;
}

function readStdin() {
  return new Promise((resolve) => {
    let buf = "";
    if (process.stdin.isTTY) return resolve("");
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (buf += c));
    process.stdin.on("end", () => resolve(buf));
    process.stdin.on("error", () => resolve(buf));
  });
}

function logFailure(line) {
  try {
    fs.mkdirSync(HOME, { recursive: true });
    fs.appendFileSync(path.join(HOME, "reach-failures.log"), `${new Date().toISOString()}\t${BASE}\t${line}\n`);
  } catch {}
}

async function call(method, route, key, surface, body) {
  let last = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${BASE}${route}`, {
        method,
        headers: {
          authorization: `Bearer ${key}`,
          "content-type": "application/json",
          "user-agent": `unl-hook/1.0 (${surface})`,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctl.signal,
      });
      const text = await res.text();
      clearTimeout(t);
      if ([502, 503, 504].includes(res.status) && attempt === 0) continue;
      return { status: res.status, text };
    } catch (err) {
      clearTimeout(t);
      last = err;
    }
  }
  const timedOut = last && last.name === "AbortError";
  return { status: 0, text: "", error: timedOut ? "timeout" : "unreachable" };
}

// ── rendering: a line-for-line port of .claude/hooks/unl-inject-delta.py ─────────────────────────
const HEADER = "=== unl relevant context — reference for this turn (served, not pushed; reason from it) ===";
const clip = (s, n) => String(s || "").replace(/\s+/g, " ").trim().slice(0, n);

function arrivedLine(titles) {
  const clean = titles.map((t) => clip(t, 70)).filter(Boolean);
  return clean.length ? "[unl] arrived: " + clean.join("; ") : "[unl] arrived: governing context for this turn (see below).";
}

function render(resp, part2File = "") {
  const catchObj = resp.decision_catch && typeof resp.decision_catch === "object" ? resp.decision_catch : {};
  const catchLine = String(catchObj.line || "").trim();
  let posture = String(resp.operating_posture || "").trim();
  if (resp.unchanged === true || !posture) return catchLine;
  const delta = { ...(resp.delta || {}) };
  // PART 2: only when this turn's part-2 hook is listening; the counts follow both parts.
  const split = resp.operating_posture_split;
  if (part2File && split && String(split.more || "").trim() && String(split.first || "").trim()) {
    try {
      writePart2(part2File, String(split.more).trim() + "\n");
      posture = String(split.first).trim();
      const moved = Array.isArray(split.more_titles) ? split.more_titles.length : 0;
      if (Array.isArray(split.full_titles)) delta.full_titles = split.full_titles;
      if (Number.isInteger(delta.n_full) && Number.isInteger(delta.n_pointer)) {
        const m = Math.min(moved, delta.n_pointer);
        delta.n_full += m;
        delta.n_pointer -= m;
      }
    } catch {}
  }
  const sources = Array.isArray(resp.canonical_sources) ? resp.canonical_sources : [];
  const titles = Array.isArray(delta.full_titles) ? delta.full_titles : sources.map((s) => s.title || "");
  const nHeld = Number.isInteger(delta.n_held) ? delta.n_held : 0;
  let head;
  if (nHeld && !titles.some((t) => String(t || "").trim())) {
    head = /^\[\d+\]\s/m.test(posture)
      ? `[unl] arrived: nothing in full — Unl held ${nHeld}, each with its why (see below).`
      : `[unl] arrived: nothing — Unl judged none of ${nHeld} related decisions bears on this turn.`;
  } else {
    head = arrivedLine(titles);
  }
  const out = [HEADER, ...(catchLine ? [catchLine] : []), head, posture];
  if (Array.isArray(resp.guidance) && resp.guidance.length) {
    out.push("[unl] connect-guidance — unl's OWN house instructions for connecting a tool, served because this turn asked how. REFERENCE, not a settled decision: walk the human through it in your own words.");
    if (resp.guidance_credential_in_chat === true) {
      out.push("[unl] credential-in-chat — something credential-shaped is in this turn. Do NOT use it, do NOT repeat it back, and do NOT treat the connection as made. Say it cannot be accepted through chat, that it should be rotated at the provider, and route to the portal Connections page.");
    }
    for (const g of resp.guidance.slice(0, 3)) {
      out.push(`[unl] guidance${g.provider ? ` (${g.provider}${g.tier ? `, tier ${g.tier}` : ""})` : ""}: ${String(g.title || "").trim()}`);
      for (const p of g.points || []) if (String(p || "").trim()) out.push(`    · ${String(p).trim()}`);
    }
  }
  const ids = sources.map((s) => String(s.id || "").slice(0, 8)).filter(Boolean);
  let prov = Number.isInteger(delta.n_full) && Number.isInteger(delta.n_pointer)
    ? `[provenance: unl /api/ask · ${delta.n_full + delta.n_pointer + nHeld} relevant · ${delta.n_full} full / ${delta.n_pointer} pointer${nHeld ? ` / ${nHeld} held` : ""} · delta server-side`
    : `[provenance: unl /api/ask · ${sources.length} cited · full serve`;
  if (resp.source_coverage) prov += " · " + String(resp.source_coverage);
  if (ids.length) prov += " · cited " + ids.join(", ");
  out.push(prov + "]");
  return out.join("\n");
}

function failureLine(r, what) {
  if (r.error === "timeout") return `unl: ${what} did not answer within ${TIMEOUT_MS / 1000}s. This turn runs without your decisions. Set UNL_ASK_TIMEOUT to wait longer.`;
  if (r.error) return `unl: could not reach ${BASE}. This turn runs without your decisions.`;
  if (r.status === 401 || r.status === 403) return "unl: your key was refused (revoked?). Run `npx unlimitless init` again to sign in. This turn runs without your decisions.";
  return `unl: ${what} answered HTTP ${r.status}. This turn runs without your decisions.`;
}

async function claudeCodeTurn(key) {
  let d;
  try {
    d = JSON.parse(await readStdin());
  } catch {
    return;
  }
  const prompt = typeof d.prompt === "string" ? d.prompt : "";
  if (!prompt.trim()) return;
  const base = partsBase(d);
  if (base) {
    touch(base + ".run");
    process.on("exit", () => touch(base + ".done"));
  }
  const body = { query: prompt, channel: "hook", surface: "claude-code", hook_parts: 2 };
  if (typeof d.session_id === "string" && d.session_id.trim()) body.session = d.session_id.trim();
  if (process.env.UNL_VENTURE && process.env.UNL_VENTURE.trim()) body.venture = process.env.UNL_VENTURE.trim();
  else Object.assign(body, surfaceWorld(d.cwd));
  const r = await call("POST", "/api/ask", key, "claude-code", body);
  if (r.status < 200 || r.status >= 300 || !r.text) {
    const line = failureLine(r, "the serve");
    logFailure(line);
    process.stdout.write(JSON.stringify({ systemMessage: line }) + "\n");
    return;
  }
  let resp;
  try {
    resp = JSON.parse(r.text);
  } catch {
    return;
  }
  const window = render(resp, base && fs.existsSync(base + ".listen") ? base + ".part2" : "");
  if (window) process.stdout.write(window + "\n");
}

async function cursorSessionStart(key) {
  await readStdin(); // Cursor sends the session payload; nothing in it is needed for the wake
  const r = await call("GET", "/api/wake", key, "cursor");
  if (r.status < 200 || r.status >= 300) {
    logFailure(failureLine(r, "the wake"));
    process.stdout.write("{}\n");
    return;
  }
  let lines = [];
  try {
    lines = JSON.parse(r.text).lines || [];
  } catch {}
  const text = lines.join("\n").trim();
  const context = text
    ? `${HEADER}\n${text}\n\nThis is the person's own Unl: their settled decisions with their reasons. Reason from it. Later in the session, when a choice may already have been made here, call the unl MCP tool ask_unl with their message.`
    : "";
  process.stdout.write(JSON.stringify(context ? { additional_context: context } : {}) + "\n");
}

if (require.main === module) {
  (async () => {
    const key = readKey();
    if (!key) return; // not set up on this machine: silent, never broken
    if (process.argv[2] === "cursor-start") return cursorSessionStart(key);
    if (process.argv[2] === "more") return partTwo();
    return claudeCodeTurn(key);
  })().catch(() => {});
}

module.exports = { render, partsBase, partTwo };
