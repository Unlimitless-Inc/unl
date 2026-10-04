"""Unl in a Pydantic AI agent: Unl's why is added to the instructions of every run, and Unl's MCP tools
let the agent read the full reasoning and propose new decisions.

    pip install pydantic-ai
    export UNL_KEY=...           # https://unlimitless.ai/portal/keys
    export OPENAI_API_KEY=...    # your agent's own model
    python unl_pydantic_ai.py "Should we add a queue for background jobs?"
"""
import os
import sys

from pydantic_ai import Agent, RunContext
from pydantic_ai.mcp import MCPToolset

sys.path.insert(0, __file__.rsplit("/", 2)[0])
from unl_ask import unl_context  # noqa: E402

unl_tools = MCPToolset("https://api.unlimitless.ai/mcp", headers={"Authorization": f"Bearer {os.environ.get('UNL_KEY', '')}"})

agent = Agent("openai:gpt-5.2", deps_type=str, toolsets=[unl_tools], instructions="You help the person with their project.")


@agent.instructions
def unl_why(ctx: RunContext[str]) -> str:
    """Re-evaluated on every run: the decisions that bear on this turn, with their reasons."""
    return unl_context(ctx.deps)


if __name__ == "__main__":
    prompt = " ".join(sys.argv[1:]) or "What have I already decided?"
    print(agent.run_sync(prompt, deps=prompt).output)
