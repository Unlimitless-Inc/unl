# Unl inside Google's Agent Development Kit

An agent built with Google's Agent Development Kit that works from what you decided and why.

The agent's instruction is a function. The kit calls it each time the agent is about to act, and the function asks Unl what bears on this agent's task, so the agent starts from your decisions and the reasons behind them. Unl's tools come in over MCP for when the agent wants the full reasoning behind a decision, or wants to report what it did.

Unl never runs the agent. It answers when the agent asks, and only you change what you decided.

## Run it

```bash
pip install "google-adk[mcp]"
export UNL_KEY=...            # from unlimitless.ai/portal/keys
python unl_adk.py --ask-only "Add retries to the export job"
```

`--ask-only` asks Unl what bears on the agent's task and shows what it was handed. It makes no model call, so it needs nothing but your own Unl.

To let the agent act as well

```bash
export GOOGLE_API_KEY=...     # your own Gemini key
python unl_adk.py "Add retries to the export job"
```

The agent plans the change and describes its first step. It says which of your decisions it followed, and says so plainly if it thinks one is wrong for the task. It stays yours to change.

Install the `mcp` extra. In version 2 of the kit, MCP support is an optional extra, and without it the kit's MCP tools are not there at all.

## What a run costs

`--ask-only` costs nothing on your Google bill. A full run makes a small number of model calls on your own key. The instruction carries Unl's answer, about 2,000 to 2,500 tokens, plus the task and the list of Unl's tools. It uses `gemini-3.5-flash` unless you set `ADK_MODEL`.

## What the agent gets

1. Your decisions that bear on its task, each with its why, from one call to `POST /api/ask` through the shared helper [`../unl_ask.py`](../unl_ask.py). An instruction function skips the kit's `{state}` templating, so Unl's answer reaches the model exactly as written.
2. Unl's tools over MCP, through `McpToolset` with `StreamableHTTPConnectionParams` at `https://api.unlimitless.ai/mcp` and your key.

If Unl cannot be reached, the agent carries on without it.

## Checked

On 4 Oct 2026, with `google-adk` 2.11.0 and its `mcp` extra.

- The agent, the runner and Unl's toolset construct with the instruction function, and every name the script uses resolves.
- `--ask-only` against the live Unl gave the agent about 9,200 characters carrying four decisions.
- The kit's `McpToolset` connected to Unl live and listed its eight tools.
- A full run with a Gemini key has not been made yet.
