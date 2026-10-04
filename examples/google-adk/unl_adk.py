"""Unl in an agent built with Google's Agent Development Kit: before the agent acts, it asks Unl what bears
on its task, as itself, and works from your decisions and the reasons behind them. Unl's MCP tools let it
read the full reasoning behind a decision, or report what it did.

    pip install "google-adk[mcp]"   # MCP support is an extra in ADK 2.x
    export UNL_KEY=...           # https://unlimitless.ai/portal/keys
    python unl_adk.py --ask-only "Add retries to the export job"     # asks Unl, no model call
    export GOOGLE_API_KEY=...    # your agent's own Gemini key
    python unl_adk.py "Add retries to the export job"                # the agent acts

The instruction is a function, so ADK calls it each time the agent is about to act, and passes the
text through untouched (an instruction function skips ADK's {state} templating). Unl never runs the
agent. It answers when the agent asks, and only you change what you decided.
"""
import asyncio
import os
import sys

sys.path.insert(0, __file__.rsplit("/", 2)[0])
from unl_ask import unl_context  # noqa: E402

MODEL = os.environ.get("ADK_MODEL", "gemini-3.5-flash")
ROLE = "You are a coding agent. Plan the change in at most five steps, then describe the first step concretely."


def task_of(ctx) -> str:
    content = getattr(ctx, "user_content", None)
    parts = getattr(content, "parts", None) or []
    return " ".join(p.text for p in parts if getattr(p, "text", None)).strip()


def with_unl(ctx) -> str:
    """Called by ADK when the agent is about to act: the decisions that bear on this task, with their reasons."""
    why = unl_context(f"{ROLE} Task: {task_of(ctx)}", model=MODEL)
    context = f"\n\nWhat the person has decided that bears on this, and why, from Unl:\n\n{why}" if why else ""
    return (
        f"{ROLE}{context}\n\nIf a decision above bears on what you do, say which one and how you followed it. "
        "If you think one is wrong for this task, say so plainly; it stays the person's to change."
    )


def decision_titles(why: str) -> list[str]:
    import re
    return [m.group(2).strip() for m in re.finditer(r"^\[(\d+)\] (.+?)(?= \(canonical| — why:| — open:| — held back:|$)", why, re.M)]


async def act(task: str) -> str:
    from google.adk.agents import LlmAgent
    from google.adk.runners import InMemoryRunner
    from google.adk.tools.mcp_tool import McpToolset, StreamableHTTPConnectionParams
    from google.genai import types

    unl_tools = McpToolset(connection_params=StreamableHTTPConnectionParams(
        url=os.environ.get("UNL_BASE_URL", "https://api.unlimitless.ai").rstrip("/") + "/mcp",
        headers={"Authorization": f"Bearer {os.environ.get('UNL_KEY', '')}"},
    ))
    agent = LlmAgent(name="coder", model=MODEL, instruction=with_unl, tools=[unl_tools])
    runner = InMemoryRunner(agent=agent, app_name="unl-adk-example")
    session = await runner.session_service.create_session(app_name="unl-adk-example", user_id="you")
    answer = ""
    try:
        async for event in runner.run_async(
            user_id="you", session_id=session.id, new_message=types.Content(role="user", parts=[types.Part(text=task)])
        ):
            if event.is_final_response() and event.content and event.content.parts:
                answer = "".join(p.text or "" for p in event.content.parts)
    finally:
        await unl_tools.close()
    return answer


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--ask-only"]
    task = " ".join(args) or "Add retries to the export job"
    if not os.environ.get("UNL_KEY"):
        print("Set UNL_KEY first (unlimitless.ai/portal/keys). Without it the agent runs without your decisions.")
    if "--ask-only" in sys.argv:
        why = unl_context(f"{ROLE} Task: {task}", model=MODEL)
        titles = decision_titles(why)
        print(f"Unl → coder: {len(why)} characters, {len(titles)} decision(s)")
        for t in titles:
            print(f"  · {t}")
    elif not os.environ.get("GOOGLE_API_KEY"):
        print("Set GOOGLE_API_KEY to let the agent act, or run with --ask-only.")
        sys.exit(1)
    else:
        print(asyncio.run(act(task)))
