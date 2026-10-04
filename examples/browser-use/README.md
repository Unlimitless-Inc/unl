# Unl beside Browser Use

Browser Use gives an agent the web. Unl gives it what you decided and why. Before the agent opens a page, it asks Unl what bears on its task and browses within your decisions.

The more an agent can do on the web, the more it needs your reasons before it acts. Keep a decision such as "Never fill in a sign-up form on someone else's site without asking me first, because it hands out my email address", then give the agent the task below. It reads that decision before it touches the page, and stops and says so where the decision applies.

Unl never runs the agent. It answers when the agent asks, and only you change what you decided.

## Run it

```bash
pip install browser-use
export UNL_KEY=...            # from unlimitless.ai/portal/keys
python unl_browser_use.py --ask-only "Sign up for the newsletter on example.com"
```

`--ask-only` asks Unl what bears on the task and shows what the agent would be handed. It opens no browser and makes no model call.

To let the agent browse as well

```bash
export OPENAI_API_KEY=...     # the agent's own model
python unl_browser_use.py "Sign up for the newsletter on example.com"
```

## What a run costs

The Browser Use library is open source and runs on your own machine, so the only charge is your own model key, a few calls per page for up to 15 steps. Browser Use's cloud is not needed for this example. Set `BROWSER_USE_MODEL` to choose the model.

## How it works

Your decisions that bear on the task, each with its why, come from one call to `POST /api/ask` through the shared helper [`../unl_ask.py`](../unl_ask.py), and go into the agent through Browser Use's own `extend_system_message`. Browser Use's MCP client starts a local command, while Unl's tools are a remote MCP server, so this example hands the agent your decisions directly and does not wire Unl's tools in.

If Unl cannot be reached, the agent carries on without it.

## Checked

On 4 Oct 2026, with `browser-use` 0.13.10.

- The agent constructs with `extend_system_message`, and every name the script uses resolves.
- `--ask-only` against the live Unl handed the agent about 6,100 characters of decisions.
- A full browsing run has not been made yet.
