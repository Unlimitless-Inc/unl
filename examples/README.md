# Unl in the ecosystems

One small working example per framework. Each adds Unl, your why agent, to an agent you already build, and changes nothing else about it. Every example uses the same key, `UNL_KEY`, from unlimitless.ai/portal/keys.

There are two ways in, and most examples show both:
- **The why on every call.** A middleware, hook or instructions function asks Unl what bears on the turn, and puts the answer into the model's context. The model cannot skip it.
- **Unl's tools over MCP.** The agent can read the full reasoning behind a decision and propose a new one for the person to confirm. The address is `https://api.unlimitless.ai/mcp`, with `Authorization: Bearer $UNL_KEY`.

The shared Python helper [`unl_ask.py`](unl_ask.py) is the one HTTP call behind the why: `POST /api/ask`. It fails open, so an agent carries on if Unl cannot be reached.

| Folder | Framework | Why on every call | Unl's tools | Checked 25 Sep 2026 |
|---|---|---|---|---|
| [netlify](netlify) | Netlify Functions + AI Gateway | `withUnl` from `@unlimitless/ai-sdk` | (none) | typecheck clean on `@netlify/functions` 6.0.0, `@ai-sdk/openai` 4.0.75, `ai` 7.0.114 |
| [cloudflare](cloudflare) | Cloudflare Agents SDK | (none) | `this.addMcpServer("unl", ...)`, `this.mcp.getAITools()` | typecheck clean on `agents` 0.24.0, `workers-ai-provider` 4.0.0 |
| [langchain](langchain) | LangChain 1.4 | `@wrap_model_call` middleware | `MCPAdapter` (`langchain.mcp`) | every import resolves on langchain 1.4.2; the FastMCP client that `MCPAdapter` takes listed Unl's 8 tools live over a Bearer key |
| [pydantic-ai](pydantic-ai) | Pydantic AI | `@agent.instructions` | `MCPToolset` | imports resolve on pydantic-ai 2.50.0; `MCPToolset` connected live with the key |
| [google-adk](google-adk) | Google's Agent Development Kit | an instruction function that asks Unl each time the agent is about to act | `McpToolset` with `StreamableHTTPConnectionParams` (needs the `mcp` extra) | the agent constructs on `google-adk` 2.11.0; the ask ran live, and the toolset listed Unl's 8 tools live (4 Oct) |
| [litellm](litellm) | LiteLLM proxy | `async_pre_call_hook` | the proxy's `mcp_servers` | the hook ran live: Unl's window sat after the caller's system message and before the user's |
| [openai-agents](openai-agents) | OpenAI Agents SDK, with a handoff between two agents | each agent's `instructions` function asks `POST /api/ask` as that agent | `MCPServerStreamableHttp` | typecheck clean on `@openai/agents` 0.18.0; the ask ran live for both agents (4 Oct) |
| [composio](composio) | Composio | (none) | custom MCP toolkit (`register.sh`) | imports resolve on composio 0.24.0; the toolkit upsert is not run (it writes to a Composio project) |
| [e2b](e2b) | E2B, a sandbox the agent's code runs in | the model's system message, from `unl_ask.py`, before it writes code | (none) | names resolve on `e2b-code-interpreter` 2.10.1; the ask ran live (4 Oct) |
| [browser-use](browser-use) | Browser Use, an agent that drives a browser | `extend_system_message`, from `unl_ask.py`, before it opens a page | (none; its MCP client is local commands only) | the agent constructs on `browser-use` 0.13.10; the ask ran live (4 Oct) |
| [tanstack](tanstack) | TanStack AI | `systemPrompts` from `serve()` | `@tanstack/ai-mcp` | typecheck clean on `@tanstack/ai` 0.61.0, `@tanstack/ai-mcp` 0.4.6 |
| [github-copilot](github-copilot) | GitHub Copilot custom agent | the agent profile asks `unl/ask_unl` before it plans | `mcp-servers` in `.github/agents/unl.agent.md` (key header, three tools) | Unl's side listed its tools live over a Bearer key, 4 Oct; the walk inside a Copilot task is still to come |
| [mastra](mastra) | Mastra, with a Claude Code agent and a Cursor agent side by side | each agent asks `POST /api/ask` as itself before it acts | `sdkOptions.mcpServers` on each agent | typecheck clean on `@mastra/core` 1.74.0, `@mastra/claude` 0.3.2, `@mastra/cursor` 0.3.2; the ask ran live for both agents (4 Oct) |

Checked the same day:
- `unl_ask.py` against the live API: a 15,539-character window.
- An MCP client with a Bearer key listed `ask_unl`, `connect_to_unl`, `get_from_unl`, `log_to_unl`, `manage_unl`, `save_to_unl`, `submit_feedback` and `write_to_tool`.

No example was run against a paid model call.

For the Vercel stack (the AI SDK package, eve and a Deploy-with-Vercel template), see [`../vercel`](../vercel) and [`packages/ai-sdk`](../../packages/ai-sdk).
