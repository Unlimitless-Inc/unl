"""The one call every Python example shares: ask Unl what bears on this turn.

POST https://api.unlimitless.ai/api/ask with {"query": <the turn>} and your key. The answer's
`operating_posture` is a text block: the decisions that bear, each with its reason. Put it in the
model's context. One HTTP call, no model call on your bill. If Unl cannot be reached, this returns ""
and your agent carries on without it.
"""
import json
import os
import urllib.request

UNL_ASK_URL = os.environ.get("UNL_BASE_URL", "https://api.unlimitless.ai").rstrip("/") + "/api/ask"


def unl_context(query: str, *, model: str | None = None, timeout: float = 4.0) -> str:
    key = os.environ.get("UNL_KEY")
    if not key or not query.strip():
        return ""
    body = {"query": query, "surface": "python"}
    if model:
        body["receiver_model"] = model
    req = urllib.request.Request(
        UNL_ASK_URL,
        data=json.dumps(body).encode(),
        headers={"authorization": f"Bearer {key}", "content-type": "application/json", "user-agent": "unl-python-example/0.1"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r).get("operating_posture") or ""
    except Exception as e:  # fail open: never stop the agent because Unl did
        print(f"[unl] carrying on without Unl: {e}")
        return ""


if __name__ == "__main__":
    import sys
    text = unl_context(" ".join(sys.argv[1:]) or "What have I already decided?")
    print(f"Unl answered ({len(text)} characters)." if text else "Unl returned nothing (is UNL_KEY set?)")
