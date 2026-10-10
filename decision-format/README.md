# The kept-decision format, version 1

A person decides things while they work with AI: what to build, what to leave out, and why. This format is a way to keep one of those decisions as a single object, with its reasons and where it came from, so that any tool can read it, any tool can check it has not been altered, and no tool can pass off its own suggestion as the person's decision.

Unl keeps decisions in this format. This document is written so that you can keep them in it too, without Unl, without an account, and without asking anyone. The format and everything in this folder are under the MIT licence.

## In plain words

A kept decision has six parts.

1. **The decision.** A short title and the statement itself, in the words it was settled in.
2. **Its reason.** One overall reason, as the person confirmed it, and an ordered list of supporting points. Each supporting point has a type, such as a fact, a constraint or a principle.
3. **What was ruled out.** A supporting point whose type is `rejected_alternative`. It sits with the other reasons because the reason a road was not taken is part of why this one was.
4. **What it applies to.** A list of tags, such as `architecture` or `pricing`.
5. **Who decided, and when.** The person who made it canon and the time they did. A model may propose the wording; it is recorded separately and can never be the one who decided.
6. **What it replaced.** The earlier decisions this one retired, if any, and later, the decision that retired it.

Parts 1 to 5 are the **kernel**: the decision as it was settled. Part 6, and whether the decision is still current, is **lifecycle**: it changes after the fact, when something else is decided.

Every decision has an **address** computed from its kernel. Anyone holding the record can compute the address again and compare. If the two match, the kernel is exactly what was settled. Because lifecycle is left out, a decision keeps its address for life, including after it is retired.

### The one fixed rule

**Only a person makes a decision canon.** A record whose status is `canonical` must name the person who made it so, and that name must not be the model that proposed it. An implementation may let models propose, draft and rank as much as it likes. A proposal is a different object with a different address (see Proposals below), and nothing in this format turns one into the other except a person.

Everything else in this format is open to change in later versions. This rule is not.

## The record

```json
{
  "id": "walk1:sha256:<64 hex>",
  "ruling": {
    "id": "example-decision-exports-queue",
    "title": "Exports run on a queue",
    "statement": "Exports run on a background queue, not inside the request.",
    "authority_scope": ["architecture", "exports"],
    "status": "canonical"
  },
  "why": {
    "overall_why": "Larger files exceed the request timeout, so the export has to outlive the request.",
    "derivation_shape": "a measured failure replaced an earlier choice",
    "pillars": [
      { "type": "fact", "statement": "Exports over 40 MB time out at 30 seconds." },
      { "type": "rejected_alternative", "statement": "Raising the timeout: it moves the limit without removing it." }
    ]
  },
  "provenance": {
    "wasGeneratedBy": "deliberation-exports-queue",
    "wasDerivedFrom": ["incident-export-timeout"],
    "ratifiedBy": "a.person@example.com",
    "ratifiedAt": "2026-07-27T10:38:32.815Z",
    "proposerModel": "an-assistant-model",
    "proposedAt": "2026-07-27T10:30:00.000Z",
    "wasRevisionOf": "example-decision-exports-sync",
    "wasRevisionOfAll": ["example-decision-exports-sync"],
    "supersededBy": null
  }
}
```

The field names are the ones the hosted service has published since version 1 of its API. `ruling` is the decision, `why` is its reason, and `pillars` are the supporting points. The provenance names follow W3C PROV. The full schema is [`decision.schema.json`](decision.schema.json) (JSON Schema 2020-12).

| Part | Field | Kernel? |
|---|---|---|
| The decision | `ruling.id`, `ruling.title`, `ruling.statement` | yes |
| What it applies to | `ruling.authority_scope` (order counts) | yes |
| Its reason | `why.overall_why`, `why.derivation_shape`, `why.pillars` (order counts) | yes |
| What was ruled out | `why.pillars[]` with `type: "rejected_alternative"` | yes |
| Who decided, and when | `provenance.ratifiedBy`, `provenance.ratifiedAt` | yes |
| Where it came from | `provenance.wasGeneratedBy`, `wasDerivedFrom`, `proposerModel`, `proposedAt` | yes |
| What it replaced | `provenance.wasRevisionOfAll` (and `wasRevisionOf` when it is exactly one) | no |
| What replaced it | `provenance.supersededBy` | no |
| Whether it is current | `ruling.status`: `canonical`, `superseded` or `candidate` | no |
| Optional flags | `ruling.is_standing`, `ruling.is_north_star`, `ruling.venture_id` | no |
| How this copy was delivered | `transport` (optional) | no |

Supporting point types: `constraint`, `tension`, `prior_ruling`, `option_weighed`, `fact`, `precedent`, `principle`, `rejected_alternative`, `verbatim_quote`. A reader must accept a type it does not know and keep it as written.

`ratifiedAt` is an ISO 8601 UTC time with milliseconds, such as `2026-07-27T10:38:32.815Z`. Other fields that may be absent are written as `null` or `[]`, never left out, because the address is computed over them.

## Computing the address

1. Take the kernel, exactly these fields and no others:
   ```
   { ruling:     { id, title, statement, authority_scope },
     why:        { overall_why, derivation_shape, pillars: [ { type, statement }, ... ] },
     provenance: { wasGeneratedBy, wasDerivedFrom, ratifiedBy, ratifiedAt, proposerModel, proposedAt } }
   ```
2. Serialise it as JSON with every object's keys sorted, no whitespace, and non-ASCII characters written as themselves rather than escaped. The kernel holds only strings, arrays, objects and `null`, so this is the same text RFC 8785 (JSON Canonicalization Scheme) produces.
3. Prefix the text with the four bytes `walk` and one zero byte.
4. Encode as UTF-8 and take the SHA-256 digest, in lowercase hex.
5. The address is `walk1:sha256:` followed by the digest.

To check a record, compute its address and compare it with `id`. A mismatch means the kernel is not what was settled, or the record was built from a different kernel.

## Proposals

A proposal is a suggestion that is not yet a decision, from a person or an agent. It is addressed by its content and its reason, so proposing the same thing twice gives the same address:

1. Trim surrounding whitespace from the content and from the reason (an absent reason is the empty string).
2. Serialise `{"content": <content>, "why": <reason>}` as JSON, in that key order, with no whitespace.
3. Prefix with `candidate` and one space, encode as UTF-8, take the SHA-256 digest in lowercase hex.
4. The address is `cand1:sha256:` followed by the digest.

A proposal never becomes canon by being proposed again, by being popular, or by a model saying so. Only a person does that, and the result is a new decision record with its own address.

## Checking your implementation

[`vectors.json`](vectors.json) holds test records with the addresses the hosted service computes for them, including non-ASCII text, control characters and keys given in a different order. It also holds pairs that must keep or change their address, and records a reader must refuse.

```bash
node conformance.mjs                                # this folder's reference code
node conformance.mjs --impl "python3 decision_id.py" # any implementation, in any language
node conformance.mjs --check records.json           # records you hold
```

`--impl` sends each test record to your command as one JSON object on stdin (`"kind": "decision"` or `"kind": "proposal"`) and expects the address on stdout. The exit code is 0 only when every check passes.

## Reference code

- [`decision-format.mjs`](decision-format.mjs): a reader and writer for Node 18 or later, with no dependencies. `writeDecision` builds a record and computes its address; `readDecision` checks shape, the fixed rule and the address.
- [`decision_id.py`](decision_id.py): the address alone, in Python with the standard library, written from this document as a check that it is enough to implement from.

## Records from the hosted service

Records the hosted service hands out through its API conform to this format. An earlier version of the service left the ratification time out of the address by mistake, so records served before that was corrected carry addresses that do not recompute. Those addresses still resolve on the service; a fresh copy of the same decision carries the corrected address.

## What is not settled yet

These are the places a second implementation is most likely to want a change. They are listed before anyone is asked to adopt the format, because a format only its author can live with will not be adopted.

1. **Names.** `ruling`, `pillars` and `walk1` are the hosted service's own words. A neutral version would say `decision`, `points` and `decision1`. The names are inside the address, so renaming them means a version 2 with a new prefix, never an edit to version 1.
2. **Who decided.** `ratifiedBy` is free text. Between implementations it needs a form both sides can resolve, and the fixed rule needs more than a name to be checked by a stranger: a signature by the person, or by a key that stands for them.
3. **References.** `wasGeneratedBy`, `wasDerivedFrom` and the replacement fields hold identifiers that only mean something inside the implementation that wrote them. Records that cross implementations need references that say where they resolve.
4. **What was ruled out.** It lives among the supporting points, by type. Some implementations will want it as its own list.
5. **Supporting point types.** The nine types are a convention, not a closed list in the schema.
6. **Two prefixes.** Decisions use a zero byte after `walk`; proposals use a space after `candidate`. A version 2 would use one rule for both.
7. **`proposedAt`.** Unlike `ratifiedAt`, it is not yet held to ISO 8601.
8. **Lifecycle flags.** `is_standing` and `is_north_star` are the hosted service's ideas and are optional here; another implementation may never set them.

If you are building one and something here stops you, open an issue in this repository.
