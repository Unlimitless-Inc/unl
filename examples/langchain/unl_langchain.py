"""Unl in a LangChain agent (langchain >= 1.4): Unl's why reaches every model call through middleware,
and Unl's MCP tools let the agent read the full reasoning and propose new decisions.

    pip install "langchain[mcp]" langchain-anthropic
    export UNL_KEY=...            # https://unlimitless.ai/portal/keys
    export ANTHROPIC_API_KEY=...  # your agent's own model
    python unl_langchain.py "Should we add a queue for background jobs?"
"""
import asyncio
import sys

from fastmcp.client import Client
from langchain.agents import create_agent
from langchain.agents.middleware import ModelRequest, ModelResponse, wrap_model_call
from langchain.mcp import MCPAdapter
from langchain.messages import SystemMessage

sys.path.insert(0, __file__.rsplit("/", 2)[0])
from unl_ask import unl_context  # noqa: E402

UNL_MCP_URL = "https://api.unlimitless.ai/mcp"


def _last_user_text(request: ModelRequest) -> str:
    for m in reversed(request.messages):
        if getattr(m, "type", "") == "human":
            return m.text if isinstance(getattr(m, "text", None), str) else str(m.content)
    return ""


@wrap_model_call
def unl_why(request: ModelRequest, handler) -> ModelResponse:
    """Structural reach: runs on every model call, so the agent cannot skip it."""
    ctx = unl_context(_last_user_text(request))
    if not ctx:
        return handler(request)
    blocks = list(request.system_message.content_blocks) if request.system_message else []
    return handler(request.override(system_message=SystemMessage(content=blocks + [{"type": "text", "text": ctx}])))


async def main(prompt: str) -> None:
    import os
    async with MCPAdapter(Client(UNL_MCP_URL, auth=os.environ["UNL_KEY"])) as adapter:
        tools = await adapter.list_tools()
        agent = create_agent("anthropic:claude-sonnet-5", tools, middleware=[unl_why])
        result = await agent.ainvoke({"messages": [{"role": "user", "content": prompt}]})
        print(result["messages"][-1].content)


if __name__ == "__main__":
    asyncio.run(main(" ".join(sys.argv[1:]) or "What have I already decided?"))
