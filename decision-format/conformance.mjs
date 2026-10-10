#!/usr/bin/env node
// Conformance check for the kept-decision format, version 1. MIT licence. Node 18 or later.
//
//   node conformance.mjs                    check this folder's reference code against the vectors
//   node conformance.mjs --impl "<command>" check YOUR implementation: for every vector the command
//                                           gets one JSON object on stdin, {"kind":"decision", ...}
//                                           or {"kind":"proposal", ...}, and must print the id
//   node conformance.mjs --check <file>     check records you hold: one record, an array of them,
//                                           or a response with a "walks" array
//
// Exit code 0 means every check passed. Anything else names what failed.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { decisionId, proposalId, readDecision } from "./decision-format.mjs";

const here = (f) => new URL(f, import.meta.url);
const vectors = JSON.parse(readFileSync(here("./vectors.json"), "utf8"));
const args = process.argv.slice(2);
let failed = 0, passed = 0;
const report = (ok, name, detail = "") => {
  if (ok) passed++; else failed++;
  console.log(`${ok ? "pass" : "FAIL"}  ${name}${ok || !detail ? "" : `\n      ${detail}`}`);
};

if (args[0] === "--check") {
  if (!args[1]) { console.error("usage: node conformance.mjs --check <file>"); process.exit(2); }
  const data = JSON.parse(readFileSync(args[1], "utf8"));
  const records = Array.isArray(data) ? data : Array.isArray(data.walks) ? data.walks : [data];
  if (records.length === 0) { console.error("FAULT: no records found in " + args[1]); process.exit(2); }
  records.forEach((r, i) => {
    const { ok, errors } = readDecision(r);
    report(ok, `record ${i} ${r?.id ?? "(no id)"}`, errors.join("\n      "));
  });
} else {
  const impl = args[0] === "--impl" ? args[1] : null;
  if (args[0] === "--impl" && !impl) { console.error('usage: node conformance.mjs --impl "<command>"'); process.exit(2); }
  const run = (input) => execSync(impl, { input: JSON.stringify(input), encoding: "utf8" }).trim();

  for (const v of vectors.decisions) {
    let got;
    try { got = impl ? run({ kind: "decision", ...v.input }) : decisionId(v.input); }
    catch (e) { report(false, `decision id: ${v.name}`, String(e.message).split("\n")[0]); continue; }
    report(got === v.id, `decision id: ${v.name}`, `expected ${v.id}\n      got      ${got}`);
  }
  for (const v of vectors.proposals) {
    let got;
    try { got = impl ? run({ kind: "proposal", content: v.content, why: v.why }) : proposalId(v.content, v.why); }
    catch (e) { report(false, `proposal id: ${v.name}`, String(e.message).split("\n")[0]); continue; }
    report(got === v.id, `proposal id: ${v.name}`, `expected ${v.id}\n      got      ${got}`);
  }
  if (!impl) {
    for (const v of vectors.lifecycle) {
      const a = decisionId(v.before), b = decisionId(v.after);
      report(v.same_id ? a === b : a !== b, `lifecycle: ${v.name}`, `${v.same_id ? "id should stay" : "id should move"}: ${a} vs ${b}`);
    }
    for (const v of vectors.invalid) {
      const { ok, errors } = readDecision(v.record);
      const named = errors.some((e) => e.includes(v.error));
      report(!ok && named, `rejects: ${v.name}`, ok ? "was accepted" : `errors did not mention "${v.error}": ${errors.join("; ")}`);
    }
  }
}

if (passed + failed === 0) { console.error("FAULT: nothing was checked"); process.exit(2); }
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
