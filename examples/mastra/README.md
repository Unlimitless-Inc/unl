# Unl inside Mastra

Two coding agents from two different companies, run by one Mastra setup, both working from what you decided and why.

Mastra runs a Claude Code agent and a Cursor agent side by side. Before either one acts, it tells Unl who it is and what it is about to do, and Unl hands it the decisions that bear on that, with the reasons behind them, shaped for that agent. Each agent then does the work itself. Change a decision in any AI you use and both agents work from the new one on their next run, with nobody writing them a new brief.

Mastra runs the agents. Unl never does. It answers when an agent asks, and only you change what you decided.

## Run it

```bash
npm install
export UNL_KEY=...            # from unlimitless.ai/portal/keys
npm run ask-only -- "Add retries to the export job"
```

`ask-only` asks Unl on behalf of both agents and shows what each one was handed. It makes no model call, so it needs nothing but your own Unl.

To let both agents do the work as well

```bash
export ANTHROPIC_API_KEY=...  # for the Claude Code agent
export CURSOR_API_KEY=...     # for the Cursor agent
export CURSOR_MODEL=...       # a Cursor model id
export WORKDIR=/path/to/your/repo
npm start -- "Add retries to the export job"
```

The builder makes the change and the reviewer checks it. Each one says which of your decisions it followed, and says so plainly if it thinks one is wrong for the task. It stays yours to change.

## What each agent gets

1. Your decisions that bear on its task, each with its why, from one call to `POST /api/ask` (see `src/unl.ts`). The agent names itself as `claude-code` or `cursor` and gives its model, so Unl can shape the answer for it.
2. Unl's tools over MCP, at `https://api.unlimitless.ai/mcp` with your key, for when the agent wants the full reasoning behind a decision or wants to report what it did.

If Unl cannot be reached, each agent carries on without it.

## Add another agent

Any agent Mastra can run takes the same two steps. Ask Unl before it acts, then give it the MCP server. Agents that Mastra runs through the Agent Client Protocol, such as Codex, follow the same pattern.

## Checked

On 4 Oct 2026, with `@mastra/core` 1.74.0, `@mastra/claude` 0.3.2 and `@mastra/cursor` 0.3.2.

- `npm install` and `npm run typecheck` pass from a clean folder.
- `npm run ask-only` against the live Unl gave the builder and the reviewer each a window of about 7,000 characters carrying the same four decisions, with each agent named in its request.
- `npm start` with both model keys has not been run yet.
