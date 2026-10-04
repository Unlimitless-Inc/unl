# Unl inside OpenAI's Agents SDK

Two agents with a handoff between them, both working from what you decided and why, and the second never needs the first to pass your reasoning along.

A handoff is where reasoning usually gets dropped. The first agent knows what you decided, hands off, and the second starts with only the conversation. Here each agent's instructions are a function the SDK calls when that agent starts acting, and the function asks Unl what bears on this agent's task. So after the planner hands off, the writer asks Unl itself and starts from your decisions and their reasons.

Unl never runs the agents. It answers when an agent asks, and only you change what you decided.

## Run it

```bash
npm install
export UNL_KEY=...            # from unlimitless.ai/portal/keys
npm run ask-only -- "Plan the move of the export job to the queue"
```

`ask-only` asks Unl on behalf of both agents and shows what each one was handed. It makes no model call, so it needs nothing but your own Unl.

To let the agents act as well

```bash
export OPENAI_API_KEY=...
npm start -- "Plan the move of the export job to the queue"
```

The planner writes a short plan and hands off to the writer, who drafts the first step. Each one says which of your decisions it followed, and says so plainly if it thinks one is wrong for the task. It stays yours to change.

## What a run costs

`ask-only` costs nothing on your OpenAI bill. `npm start` makes a few model calls on your own key, one or two per agent. Each agent's instructions carry Unl's answer, about 2,000 to 2,500 tokens, plus the task and the list of Unl's tools. It uses the SDK's default model unless you set `OPENAI_DEFAULT_MODEL`.

## What each agent gets

1. Your decisions that bear on its task, each with its why, from one call to `POST /api/ask` inside its instructions function (see `src/unl.ts`).
2. Unl's tools over MCP, through `MCPServerStreamableHttp` at `https://api.unlimitless.ai/mcp` with your key, for when the agent wants the full reasoning behind a decision or wants to report what it did.

If Unl cannot be reached, each agent carries on without it.

## Checked

On 4 Oct 2026, with `@openai/agents` 0.18.0.

- `npm install` and `npm run typecheck` pass from a clean folder.
- `npm run ask-only` against the live Unl gave the planner and the writer each their own answer, about 6,900 and 9,600 characters, carrying the same four decisions.
- `npm start` with an OpenAI key has not been run yet.
