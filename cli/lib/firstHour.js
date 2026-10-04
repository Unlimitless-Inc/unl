"use strict";
/*
 * THE FIRST HOUR, part one: read what the developer already wrote down (, "HOW UNL
 * EXTRACTS WHAT A DEVELOPER DECIDED", item 1 — the files that are literally decisions).
 *
 * WHAT IT READS. Only the places developers write choices and rules: CLAUDE.md, AGENTS.md, the
 * Cursor and Copilot rule files, CONTRIBUTING, a README's conventions, an ADR folder. Never source
 * code, tests, types or the build: the model can read those itself, and pulling them in would be
 * the pile everyone else builds (item 5).
 *
 * WHAT HAPPENS TO IT. Each file goes to POST /api/v1/import, which pulls out candidate decisions
 * and holds them INERT. Nothing becomes a decision until the developer says so in the
 * conversation with their agent. The files leave this machine only after the developer says yes,
 * and a file already sent unchanged is not sent twice.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT_FILES = [
  "CLAUDE.md",
  "AGENTS.md",
  "GEMINI.md",
  ".cursorrules",
  ".windsurfrules",
  "CONTRIBUTING.md",
  "README.md",
  ".github/copilot-instructions.md",
];
const DIRS = [".cursor/rules", "docs/adr", "docs/adrs", "docs/decisions", "adr", "decisions", "doc/adr"];
const MAX_FILES = 20;
const MAX_BYTES = 128000; // the import route's own text cap (V1_IMPORT_TEXT_CAP)

function discoverFiles(repo) {
  const found = [];
  const add = (rel) => {
    const abs = path.join(repo, rel);
    try {
      const st = fs.statSync(abs);
      if (st.isFile() && st.size > 0 && st.size <= MAX_BYTES) found.push(rel);
    } catch {}
  };
  for (const f of ROOT_FILES) add(f);
  for (const d of DIRS) {
    let entries = [];
    try {
      entries = fs.readdirSync(path.join(repo, d));
    } catch {
      continue;
    }
    for (const e of entries.sort()) if (/\.(md|mdc|markdown|txt)$/i.test(e)) add(path.join(d, e));
  }
  return [...new Set(found)].slice(0, MAX_FILES);
}

function ledgerPath(home) {
  return path.join(home, "imported.json");
}
function readLedger(home) {
  try {
    return JSON.parse(fs.readFileSync(ledgerPath(home), "utf8"));
  } catch {
    return {};
  }
}

async function importFiles({ apiBase, key, repo, files, home }) {
  const ledger = readLedger(home);
  const results = [];
  for (const rel of files) {
    const text = fs.readFileSync(path.join(repo, rel), "utf8");
    const digest = crypto.createHash("sha256").update(text).digest("hex");
    const id = `${path.resolve(repo)}::${rel}`;
    if (ledger[id] === digest) {
      results.push({ file: rel, skipped: true, found: 0 });
      continue;
    }
    const res = await fetch(`${apiBase}/api/v1/import`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "user-agent": "unl-init/0.1" },
      body: JSON.stringify({ text, name: rel }),
    });
    let body = null;
    try {
      body = await res.json();
    } catch {}
    if (!res.ok) {
      results.push({ file: rel, error: `HTTP ${res.status}${body && body.error ? ` ${body.error}` : ""}` });
      continue;
    }
    const n = Array.isArray(body && body.candidates) ? body.candidates.length : Number((body && body.found) || 0);
    results.push({ file: rel, found: n });
    ledger[id] = digest;
  }
  try {
    fs.writeFileSync(ledgerPath(home), JSON.stringify(ledger, null, 2));
  } catch {}
  return results;
}

module.exports = { discoverFiles, importFiles };
