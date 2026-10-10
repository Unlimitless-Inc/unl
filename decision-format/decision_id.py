#!/usr/bin/env python3
"""Compute a kept-decision id or a proposal id, in Python, from the format's README alone.

MIT licence, same as the rest of this repository. Standard library only, Python 3.8 or later.

    echo '{"kind":"decision","ruling":{...},"why":{...},"provenance":{...}}' | python3 decision_id.py
    node conformance.mjs --impl "python3 decision_id.py"
"""
import hashlib
import json
import sys


def canonical_json(value):
    # Sorted keys, no whitespace, non-ASCII written as itself: the same text JSON.stringify gives.
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def decision_id(record):
    r, w, p = record["ruling"], record["why"], record["provenance"]
    kernel = {
        "ruling": {k: r[k] for k in ("id", "title", "statement", "authority_scope")},
        "why": {
            "overall_why": w["overall_why"],
            "derivation_shape": w["derivation_shape"],
            "pillars": [{"type": x["type"], "statement": x["statement"]} for x in w["pillars"]],
        },
        "provenance": {k: p[k] for k in ("wasGeneratedBy", "wasDerivedFrom", "ratifiedBy",
                                          "ratifiedAt", "proposerModel", "proposedAt")},
    }
    body = "walk\x00" + canonical_json(kernel)
    return "walk1:sha256:" + hashlib.sha256(body.encode("utf-8")).hexdigest()


def proposal_id(content, why):
    body = "candidate " + json.dumps({"content": content.strip(), "why": (why or "").strip()},
                                     separators=(",", ":"), ensure_ascii=False)
    return "cand1:sha256:" + hashlib.sha256(body.encode("utf-8")).hexdigest()


if __name__ == "__main__":
    data = json.load(sys.stdin)
    if data.get("kind") == "proposal":
        print(proposal_id(data["content"], data.get("why")))
    else:
        print(decision_id(data))
