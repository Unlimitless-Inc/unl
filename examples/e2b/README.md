# Unl beside E2B

E2B gives an agent a computer to run code on. Unl gives it what you decided and why. Before the agent writes any code, it asks Unl what bears on the task, and the code it writes runs in an E2B sandbox.

Keep a decision about how the work is done, such as "Data scripts use the standard library only, no pandas, because they run on machines where we cannot install packages", then give the agent the task below. The code it writes follows that decision, and it says which one it followed.

Unl never runs the agent or the sandbox. It answers when the agent asks, and only you change what you decided.

## Run it

```bash
pip install e2b-code-interpreter openai
export UNL_KEY=...            # from unlimitless.ai/portal/keys
python unl_e2b.py --ask-only "Total the sales by month in the data below"
```

`--ask-only` asks Unl what bears on the task and shows what the agent would be handed. It starts no sandbox and makes no model call.

To let the agent write and run the code

```bash
export E2B_API_KEY=...        # your E2B account
export OPENAI_API_KEY=...     # the agent's own model
python unl_e2b.py "Total the sales by month in the data below"
```

## What a run costs

One model call to write the script, and a few seconds of one default sandbox to run it. E2B's free start is a one-time $100 credit with no card, and the default sandbox is billed per second at about $0.27 an hour, so a run uses a small fraction of a cent of sandbox time. Set `E2B_AGENT_MODEL` to choose the model.

## How it works

Your decisions that bear on the task, each with its why, come from one call to `POST /api/ask` through the shared helper [`../unl_ask.py`](../unl_ask.py) and go into the model's system message before it writes the script. The script then runs with `Sandbox.create()` and `run_code`.

If Unl cannot be reached, the agent carries on without it.

## Checked

On 4 Oct 2026, with `e2b-code-interpreter` 2.10.1 and `openai` 2.26.0.

- Every name the script uses resolves, and the sandbox result fields it reads exist.
- `--ask-only` against the live Unl handed the agent about 16,400 characters, nine decisions that bear on writing and running code.
- A full run with an E2B account has not been made yet.
