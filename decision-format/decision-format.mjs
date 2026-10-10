// Reference reader and writer for the kept-decision format, version 1.
// MIT licence, same as the rest of this repository. No dependencies: Node 18 or later.
//
//   import { writeDecision, readDecision, decisionId, proposalId } from "./decision-format.mjs";
//
// writeDecision(fields) returns a complete record with its id computed.
// readDecision(record) returns { ok, errors, record }: it checks the shape against
// decision.schema.json, the one fixed rule (a canonical decision names a person who made it
// canon), and that the id recomputes from the record exactly as given.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const SCHEMA = JSON.parse(readFileSync(new URL("./decision.schema.json", import.meta.url), "utf8"));

/** Sorted-key JSON. The kernel holds only strings, arrays, objects and null, so this is the
 *  same text RFC 8785 (JSON Canonicalization Scheme) gives for it. */
export function canonicalJson(value) {
  const walk = (v) => {
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = walk(v[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(walk(value));
}

/** The kernel: the part of a record its id is computed over. Everything else is lifecycle
 *  and can change without renaming the decision. */
export function kernelOf(record) {
  const r = record.ruling, w = record.why, p = record.provenance;
  return {
    ruling: { id: r.id, title: r.title, statement: r.statement, authority_scope: r.authority_scope },
    why: { overall_why: w.overall_why, derivation_shape: w.derivation_shape, pillars: w.pillars.map((x) => ({ type: x.type, statement: x.statement })) },
    provenance: {
      wasGeneratedBy: p.wasGeneratedBy, wasDerivedFrom: p.wasDerivedFrom, ratifiedBy: p.ratifiedBy,
      ratifiedAt: p.ratifiedAt, proposerModel: p.proposerModel, proposedAt: p.proposedAt,
    },
  };
}

export function decisionId(record) {
  const body = canonicalJson(kernelOf(record));
  return "walk1:sha256:" + createHash("sha256").update("walk\u0000" + body, "utf8").digest("hex");
}

/** A proposal (not yet a decision) is addressed by its trimmed content and reason. */
export function proposalId(content, why) {
  const body = JSON.stringify({ content: String(content).trim(), why: String(why ?? "").trim() });
  return "cand1:sha256:" + createHash("sha256").update("candidate " + body, "utf8").digest("hex");
}

/** Build a complete record from its fields, filling the lifecycle defaults and the id. */
export function writeDecision({ ruling, why, provenance, transport }) {
  const record = {
    ruling: { status: "canonical", ...ruling },
    why: { derivation_shape: null, pillars: [], ...why },
    provenance: {
      wasGeneratedBy: null, wasDerivedFrom: [], proposerModel: null, proposedAt: null,
      wasRevisionOfAll: [], ...provenance,
    },
  };
  if (record.provenance.ratifiedAt instanceof Date) record.provenance.ratifiedAt = record.provenance.ratifiedAt.toISOString();
  if (transport) record.transport = transport;
  const out = { id: decisionId(record), ...record };
  const { ok, errors } = readDecision(out);
  if (!ok) throw new Error("not a valid decision: " + errors.join("; "));
  return out;
}

export function readDecision(record) {
  const errors = [];
  validate(record, SCHEMA.$defs.Decision, "$", errors);
  if (errors.length === 0) {
    const p = record.provenance;
    if (record.ruling.status === "canonical" && !(typeof p.ratifiedBy === "string" && p.ratifiedBy.trim())) {
      errors.push("$.provenance.ratifiedBy: a canonical decision must name the person who made it canon");
    }
    if (p.ratifiedBy != null && p.proposerModel != null && p.ratifiedBy === p.proposerModel) {
      errors.push("$.provenance.ratifiedBy: the model that proposed it cannot be the one that made it canon");
    }
    if (typeof p.ratifiedAt === "string" && !ISO_UTC.test(p.ratifiedAt)) {
      errors.push("$.provenance.ratifiedAt: expected ISO 8601 UTC with milliseconds, e.g. 2026-07-27T10:38:32.815Z");
    }
    const expected = decisionId(record);
    if (record.id !== expected) errors.push(`$.id: does not recompute from the record (expected ${expected})`);
  }
  return { ok: errors.length === 0, errors, record };
}

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

// The subset of JSON Schema 2020-12 that decision.schema.json uses.
function validate(v, s, at, errors) {
  if (s.$ref) return validate(v, SCHEMA.$defs[s.$ref.split("/").pop()], at, errors);
  if (s.type) {
    const types = Array.isArray(s.type) ? s.type : [s.type];
    const actual = v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v;
    if (!types.includes(actual) && !(actual === "integer" && types.includes("number"))) {
      errors.push(`${at}: expected ${types.join(" or ")}, got ${actual}`);
      return;
    }
  }
  if (s.enum && !s.enum.includes(v)) errors.push(`${at}: must be one of ${s.enum.join(", ")}`);
  if (s.pattern && typeof v === "string" && !new RegExp(s.pattern).test(v)) errors.push(`${at}: does not match ${s.pattern}`);
  if (s.items && Array.isArray(v)) v.forEach((x, i) => validate(x, s.items, `${at}[${i}]`, errors));
  if (s.properties && v && typeof v === "object" && !Array.isArray(v)) {
    for (const k of s.required ?? []) if (!(k in v)) errors.push(`${at}.${k}: required`);
    for (const [k, x] of Object.entries(v)) {
      if (s.properties[k]) validate(x, s.properties[k], `${at}.${k}`, errors);
      else if (s.additionalProperties === false) errors.push(`${at}.${k}: not part of the format`);
    }
  }
}
