# Unl

Unl brings your decisions, with their reasons, to the AI you work in.

## Start

Paste this line into your AI agent and it sets Unl up for you:

```text
Read unlimitless.ai/start.md, set up Unl, and show me the decisions you find.
```

Or install it yourself:

```bash
npm install -g unlimitless
unl
```

The first time, `unl` opens your browser to sign in to Unl, names this machine's key (you can revoke it at unlimitless.ai/portal/keys) and opens the Unl terminal. After that, `unl` opens straight in.

The Unl terminal shows Unl's side of each turn as it happens: the decisions it handed your agent, with their reasons, and the ones it held back.

## Add Unl to a project

```bash
unl init            # Claude Code: the MCP server and the hook that serves your decisions on every turn
unl init --cursor   # Cursor
unl init --codex    # Codex: the server (read tools run without asking) and the per-turn hook, approved once in /hooks
```

Signing in never changes the folder you are in. Only `unl init` wires a project.

`unl init` looks before it writes. If Unl already reaches this folder, through a hook, a server under any name or in any scope, or a claude.ai connector, it says what it found and adds nothing, so no turn is ever served twice. `--dry-run` shows what it would change without changing anything, and `--repair` updates its own entry in place.

## Commands

| Command | What it does |
| --- | --- |
| `unl` | Open the Unl terminal. The first time, it signs you in. |
| `unl init` | Add Unl to Claude Code in this project (`--cursor` for Cursor, `--codex` for Codex). |
| `unl login` | Sign in on this machine. |
| `unl logout` | Remove this machine's key. |
| `unl status` | What is installed here. |
| `unl --version` | Print the version. |

Without installing, `npx unlimitless` runs the same commands.

## macOS, Linux, Windows and WSL

`unl` runs wherever Node 18 or later does. Where no browser can open (over SSH, or on a Linux machine with no display), it prints the sign-in address instead: open it on any machine that can reach this one's `127.0.0.1`. In WSL, it opens your Windows browser.

The key lives in `~/.unl`, readable only by you (on Windows, `%USERPROFILE%\.unl`, which keeps your user folder's permissions).

The terminal uses 24-bit colour where your terminal has it, and falls back to 256 colours, then to none (`NO_COLOR=1`). In the old Windows console, whose font lacks some of its symbols, it draws in plain ASCII; `UNL_ASCII=1` does the same anywhere, and `UNL_ASCII=0` turns it off.

## Changes

- **0.3.6** When Unl cannot be reached, the hook says so within the time it names (5 seconds unless you set `UNL_ASK_TIMEOUT`) and lets your agent carry on. Before, an address that never answered could hold your turn for 15 seconds.
- **0.3.5** `unl init --codex` shows Unl's tools to Codex up front. Codex otherwise keeps a server's tools behind its tool search, so a fresh session never learned Unl was there unless you named it.
- **0.3.3** `unl init` never adds Unl twice. It finds an existing Unl hook, server or unl.md first, in every scope, and says so instead. Adds `--dry-run` and `--repair`.

More: [unlimitless.ai/developers](https://unlimitless.ai/developers)
