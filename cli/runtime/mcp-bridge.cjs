#!/usr/bin/env node
/*
 * Unl's MCP server over stdio, for a client that cannot sign in to a plugin's HTTP server.
 *
 * WHY IT EXISTS. Muse Code 1.4.3 runs a plugin's HTTP MCP server but `muse mcp login` only signs in to servers
 * in settings.json, and a plugin's entry cannot read a header from a file (measured 6 Oct). Unl's /mcp already
 * takes this machine's key as a Bearer token, the way Claude Code's headers.cjs sends it, so this bridge reads
 * ~/.unl/reach-key and relays each JSON-RPC message to https://api.unlimitless.ai/mcp. One sign-in,
 * `npx unlimitless login`, then covers both the per-turn serve and the tools.
 *
 * It is a relay and nothing more: every message goes through unchanged, so what the server allows is exactly
 * what the tools allow (writes still ask first). The key never reaches argv, stdout or a log.
 *
 *   node mcp-bridge.cjs [surface]    newline-delimited JSON-RPC on stdin and stdout (MCP's stdio framing)
 */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const readline = require("readline");

const HOME = process.env.UNL_HOME || path.join(os.homedir(), ".unl");
const URL_ = (process.env.UNL_MCP_URL || "https://api.unlimitless.ai/mcp").replace(/\/+$/, "");
const SURFACE = (process.argv[2] || "muse-code").replace(/[^a-z0-9-]/g, "").slice(0, 40) || "other";
const TIMEOUT_MS = 60_000;

function readKey() {
  try {
    return fs.readFileSync(path.join(HOME, "reach-key"), "utf8").trim();
  } catch {
    return "";
  }
}

const send = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");
const fail = (id, message) => {
  if (id !== undefined && id !== null) send({ jsonrpc: "2.0", id, error: { code: -32000, message } });
};

/** The server answers JSON or an SSE stream; every `data:` line of the stream is one JSON-RPC message. */
function relayBody(contentType, text) {
  if (/text\/event-stream/i.test(contentType || "")) {
    for (const block of text.split(/\r?\n\r?\n/)) {
      const data = block.split(/\r?\n/).filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trimStart()).join("\n");
      if (!data) continue;
      try { send(JSON.parse(data)); } catch {}
    }
    return;
  }
  if (!text.trim()) return;
  try {
    const parsed = JSON.parse(text);
    for (const m of Array.isArray(parsed) ? parsed : [parsed]) send(m);
  } catch {}
}

let session = "";
async function relay(line) {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  const id = msg && typeof msg === "object" && !Array.isArray(msg) ? msg.id : undefined;
  const key = readKey();
  if (!key) return fail(id, "Unl: not signed in on this machine yet. Run `npx unlimitless login` once, then try again.");
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const headers = {
      authorization: `Bearer ${key}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      "user-agent": `unl-mcp-bridge/1.0 (${SURFACE})`,
    };
    if (session) headers["mcp-session-id"] = session;
    const res = await fetch(URL_, { method: "POST", headers, body: line, signal: ctl.signal });
    const sid = res.headers.get("mcp-session-id");
    if (sid) session = sid;
    const text = await res.text();
    if (res.status === 401 || res.status === 403) return fail(id, "Unl: this machine's key was refused (revoked?). Run `npx unlimitless login` again.");
    if (res.status >= 400) return fail(id, `Unl answered HTTP ${res.status}.`);
    relayBody(res.headers.get("content-type"), text);
  } catch (err) {
    fail(id, err && err.name === "AbortError" ? `Unl did not answer within ${TIMEOUT_MS / 1000}s.` : "Unl could not be reached.");
  } finally {
    clearTimeout(t);
  }
}

if (require.main === module) {
  // No process.exit on close: a tools/list reply is ~65 KB, and exiting with stdout still flushing to a pipe
  // cuts it mid-message (measured). The process ends by itself once the last relay has written.
  const rl = readline.createInterface({ input: process.stdin, terminal: false });
  rl.on("line", (line) => { if (line.trim()) void relay(line); });
}

module.exports = { relayBody };
