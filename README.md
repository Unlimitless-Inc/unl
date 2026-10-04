# Unl

[![smithery badge](https://smithery.ai/badge/unlimitless/Unl)](https://smithery.ai/servers/unlimitless/Unl)

Unl, your why agent. Your AI already knows how to reason. Unl gives it your reason.

You decide things while you work with AI: what to build, what to leave out, and why. Unl keeps those decisions with their reasons. When you or one of your agents is about to act, Unl hands over the ones that bear on the task, so Claude Code, Cursor, ChatGPT, Codex and the agents you build all start from the same why. You never re-brief them.

This repository holds everything that runs on your side: the `unl` command, the AI SDK package, the Cursor plugin and a working example for each agent framework. Unl itself runs as a hosted service at `api.unlimitless.ai`.

## Start in thirty seconds

**In Claude Code or Cursor:**

```bash
npm install -g unlimitless
unl              # sign in once, then the Unl terminal opens
unl init         # in your project, for Claude Code (add --cursor for Cursor)
```

Then ask your agent what you are working on.

**In any MCP client** (ChatGPT, Claude, Codex, VS Code, Grok Bot, Lovable): add the server `https://api.unlimitless.ai/mcp` and sign in when it asks.

**In an agent you build:** make a key at [unlimitless.ai/portal/keys](https://unlimitless.ai/portal/keys), set it as `UNL_KEY`, and pick your framework below.

## Connect your tools

Every tool uses the same address, `https://api.unlimitless.ai/mcp`, and signs in with OAuth once. There is no key to paste: a personal key is only for the API, never for connecting a tool.

**Claude and Claude Desktop.** Open Settings, then Connectors, and choose **Add custom connector**. Name it Unl, paste `https://api.unlimitless.ai/mcp`, and add it.

**Claude Code.** In your project, `unl init` signs you in and wires the hook that brings Unl into every turn. To add only the server:

```bash
claude mcp add --transport http unl https://api.unlimitless.ai/mcp
```

then run `/mcp`, choose unl and pick Authenticate.

**ChatGPT.** In Settings, open Plugins and switch on Developer mode. Choose **New Plugin**, name it Unl, paste `https://api.unlimitless.ai/mcp` as the server URL, set authentication to OAuth and keep Dynamic Client Registration. Then open Advanced OAuth settings and untick **OIDC enabled**: left on, ChatGPT asks for a scope Unl does not register and the connection is refused.

**Cursor.** Add the URL to `.cursor/mcp.json`, no key and no header, or install the Cursor plugin in this repository:

```json
{ "mcpServers": { "unl": { "url": "https://api.unlimitless.ai/mcp" } } }
```

**Everything else** (Codex, VS Code, Antigravity, Grok Bot, Lovable, Viktor and more): step-by-step for each, kept current, at [unlimitless.ai/connect](https://unlimitless.ai/connect).

## What is here

| Folder | What it is |
|---|---|
| [`cli/`](cli) | The `unl` command. `unl init` adds Unl to a Claude Code or Cursor project, and `unl` on its own opens the Unl terminal: each turn, the decisions Unl handed your agent with their reasons, and the ones it held back. |
| [`packages/ai-sdk/`](packages/ai-sdk) | `@unlimitless/ai-sdk`. Wrap any Vercel AI SDK model with `withUnl` and every call carries the part of your decisions that bears on it. |
| [`examples/`](examples) | One small working example per framework: Mastra, OpenAI Agents SDK, Google ADK, LangChain, Pydantic AI, LiteLLM, Cloudflare Agents, Netlify, TanStack AI, Composio, E2B, Browser Use and a GitHub Copilot custom agent. |
| [`examples/vercel-ai-sdk-chat/`](examples/vercel-ai-sdk-chat) | A chat app on the AI SDK you can deploy to Vercel with Unl already added. |
| [`.cursor-plugin/`](.cursor-plugin) and [`mcp.json`](mcp.json) | The Cursor plugin: Unl's MCP server, with sign-in discovered from the server. No key in the repository. |

## How an agent gets your why

Two ways in, and most examples show both:

- **On every call.** A middleware, hook or instructions function asks Unl what bears on the turn and puts the answer in front of the model before it acts.
- **Through Unl's tools over MCP.** The agent can open the full reasoning behind a decision, and propose a new one for you to confirm. Nothing becomes one of your decisions until you say so.

## Links

- Product: [unlimitless.ai](https://unlimitless.ai)
- Add Unl to your tools: [unlimitless.ai/connect](https://unlimitless.ai/connect)
- For developers: [unlimitless.ai/developers](https://unlimitless.ai/developers)
- Terms: [unlimitless.ai/terms](https://unlimitless.ai/terms) · Privacy: [unlimitless.ai/privacy](https://unlimitless.ai/privacy)
- Support: hello@unlimitless.ai

## Licence

MIT. See [LICENSE](LICENSE).
