"""Unl beside Browser Use: Browser Use gives an agent the web, Unl gives it what you decided and why. Before the
agent opens a page, it asks Unl what bears on its task, and works from your decisions while it browses.

    pip install browser-use
    export UNL_KEY=...           # https://unlimitless.ai/portal/keys
    python unl_browser_use.py --ask-only "Sign up for the newsletter on example.com"   # asks Unl, no browser
    export OPENAI_API_KEY=...    # the agent's own model
    python unl_browser_use.py "Sign up for the newsletter on example.com"             # the agent browses

The moment that shows it: keep a decision such as "Never fill in a sign-up form on someone else's site
without asking me first, because it hands out my email address" (tell any AI you use with Unl, and keep it),
then run the task above. The agent reads that decision before it touches the page.
Unl never runs the agent. It answers when the agent asks, and only you change what you decided.
"""
import asyncio
import os
import re
import sys

sys.path.insert(0, __file__.rsplit("/", 2)[0])
from unl_ask import unl_context  # noqa: E402

MODEL = os.environ.get("BROWSER_USE_MODEL", "gpt-5-mini")


def why_for(task: str) -> str:
    """The decisions that bear on this browsing task, with their reasons, written for the agent's system message."""
    why = unl_context(f"A browser agent is about to do this on the web. Task: {task}", model=MODEL)
    if not why:
        return ""
    return (
        "What the person has decided that bears on this task, and why, from Unl:\n\n"
        f"{why}\n\n"
        "Follow these while you browse. If one stops you from doing part of the task, stop there and say which one "
        "and why. If you think one is wrong for this task, say so plainly; it stays the person's to change."
    )


def decision_titles(why: str) -> list[str]:
    return [m.group(2).strip() for m in re.finditer(r"^\[(\d+)\] (.+?)(?= \(canonical| — why:| — open:| — held back:|$)", why, re.M)]


async def browse(task: str) -> str:
    from browser_use import Agent, ChatOpenAI

    agent = Agent(task=task, llm=ChatOpenAI(model=MODEL), extend_system_message=why_for(task))
    history = await agent.run(max_steps=15)
    return history.final_result() or "(the agent finished without a final answer)"


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--ask-only"]
    task = " ".join(args) or "Sign up for the newsletter on example.com"
    if not os.environ.get("UNL_KEY"):
        print("Set UNL_KEY first (unlimitless.ai/portal/keys). Without it the agent browses without your decisions.")
    if "--ask-only" in sys.argv:
        why = unl_context(f"A browser agent is about to do this on the web. Task: {task}", model=MODEL)
        titles = decision_titles(why)
        print(f"Unl → browser agent: {len(why)} characters, {len(titles)} decision(s)")
        for t in titles:
            print(f"  · {t}")
    elif not os.environ.get("OPENAI_API_KEY"):
        print("Set OPENAI_API_KEY to let the agent browse, or run with --ask-only.")
        sys.exit(1)
    else:
        print(asyncio.run(browse(task)))
