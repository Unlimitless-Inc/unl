# Unl inside a GitHub Copilot custom agent

Unl, your why agent. Your Copilot agent does the work, and Unl makes sure it works from what you decided, and why.

This is a recipe you copy into your own repository. It needs your own Unl and a Copilot plan that includes the cloud agent. It changes nothing else about how Copilot works.

## What the agent does

1. It says who it is and asks Unl what bears on the task.
2. It receives your decisions and their reasons, chosen for this task.
3. It does the work itself.
4. It reports what it did back to Unl.

Only you change what you decided. The agent can read your reasoning and report its work, and it has no tool that records a decision for you.

## Set it up

1. In unlimitless.ai/portal/keys, create a key for this repository.
2. In your repository, open Settings, then Secrets and variables, then Agents, and add a secret named `COPILOT_MCP_UNL_KEY` holding that key. Copilot only passes secrets whose names start with `COPILOT_MCP_` to its servers.
3. Copy [`.github/agents/unl.agent.md`](.github/agents/unl.agent.md) into the same path in your repository, then merge it into the default branch. Copilot reads custom agents from the default branch only.
4. Start a task with the `unl-builder` agent, from the agents tab or from an issue.

If you would rather declare the server for every agent in the repository, paste [`repository-mcp-settings.json`](repository-mcp-settings.json) into Settings, then Copilot, then MCP servers instead of step 3. The secret from step 2 is the same.

## Good to know

- The Copilot cloud agent connects to remote servers with a header and does not sign in with OAuth, which is why this recipe uses a key. In VS Code, adding `https://api.unlimitless.ai/mcp` to `.vscode/mcp.json` signs in with OAuth instead, with no key at all.
- Copilot calls the tools it is given without asking each time, so the recipe gives the agent only Unl's reading and reporting tools.
- On Copilot Business and Enterprise, an administrator turns on the MCP servers in Copilot policy first.

## Status

Checked 4 Oct 2026. Unl's side is proven. An MCP client sending `Authorization: Bearer <key>` connected to `https://api.unlimitless.ai/mcp` and listed Unl's tools, including the three this agent uses. The file shapes follow GitHub's own documentation for custom agents and their MCP servers. The full walk inside a Copilot task, on a clean repository and account, with its recording, is still to come, and this page says so until it passes.
