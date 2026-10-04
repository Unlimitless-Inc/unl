"""Unl beside E2B: E2B gives an agent a computer to run code on, Unl gives it what you decided and why. Before the
agent writes any code, it asks Unl what bears on the task, then the code it writes runs in an E2B sandbox.

    pip install e2b-code-interpreter openai
    export UNL_KEY=...           # https://unlimitless.ai/portal/keys
    python unl_e2b.py --ask-only "Total the sales by month in the data below"   # asks Unl, no sandbox, no model
    export E2B_API_KEY=...       # your E2B account
    export OPENAI_API_KEY=...    # the agent's own model
    python unl_e2b.py "Total the sales by month in the data below"             # the agent writes and runs code

The moment that shows it: keep a decision about how the work is done, such as "Data scripts use the standard
library only, no pandas, because they run on machines where we cannot install packages" (tell any AI you use with
Unl, and keep it), then run the task. The code the agent writes follows it.
Unl never runs the agent or the sandbox. It answers when the agent asks, and only you change what you decided.
"""
import os
import re
import sys

sys.path.insert(0, __file__.rsplit("/", 2)[0])
from unl_ask import unl_context  # noqa: E402

MODEL = os.environ.get("E2B_AGENT_MODEL", "gpt-5-mini")
DATA = "month,amount\nJan,120\nJan,80\nFeb,200\nMar,50\nMar,75\n"


def why_for(task: str) -> str:
    why = unl_context(f"A coding agent is about to write and run code for this. Task: {task}", model=MODEL)
    if not why:
        return ""
    return (
        "What the person has decided that bears on this, and why, from Unl:\n\n"
        f"{why}\n\n"
        "Write code that follows these. If one decides how the work is done, do it that way and say which one."
    )


def decision_titles(why: str) -> list[str]:
    return [m.group(2).strip() for m in re.finditer(r"^\[(\d+)\] (.+?)(?= \(canonical| — why:| — open:| — held back:|$)", why, re.M)]


def write_and_run(task: str) -> str:
    from e2b_code_interpreter import Sandbox
    from openai import OpenAI

    system = "You write one short Python script that does the task. Reply with the code only, no fences.\n\n" + why_for(task)
    reply = OpenAI().chat.completions.create(
        model=MODEL,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": f"{task}\n\nThe data, as CSV:\n{DATA}"}],
    )
    code = re.sub(r"^```(?:python)?\s*|\s*```$", "", (reply.choices[0].message.content or "").strip())
    with Sandbox.create() as sandbox:
        run = sandbox.run_code(code)
    out = "".join(run.logs.stdout) if run.logs and run.logs.stdout else ""
    err = f"\n(the sandbox reported an error: {run.error.name})" if run.error else ""
    return f"The agent wrote\n\n{code}\n\nand the sandbox printed\n\n{out}{err}"


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if a != "--ask-only"]
    task = " ".join(args) or "Total the sales by month in the data below"
    if not os.environ.get("UNL_KEY"):
        print("Set UNL_KEY first (unlimitless.ai/portal/keys). Without it the agent works without your decisions.")
    if "--ask-only" in sys.argv:
        why = unl_context(f"A coding agent is about to write and run code for this. Task: {task}", model=MODEL)
        titles = decision_titles(why)
        print(f"Unl → coding agent: {len(why)} characters, {len(titles)} decision(s)")
        for t in titles:
            print(f"  · {t}")
    elif not (os.environ.get("E2B_API_KEY") and os.environ.get("OPENAI_API_KEY")):
        print("Set E2B_API_KEY and OPENAI_API_KEY to let the agent write and run code, or run with --ask-only.")
        sys.exit(1)
    else:
        print(write_and_run(task))
