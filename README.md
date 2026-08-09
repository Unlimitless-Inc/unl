# Unl

*Think inside your AI world.*

**Unl is a remote MCP server that keeps the decisions you have already settled, together with the
reasoning behind them, and serves them into your AI's context before it acts.** Connect it once with
a URL, and every session after that starts inside your own frame: what you decided, why it stands,
what you are aiming at, and where the work actually got to.

One endpoint, eleven walked surfaces, no key to paste.

| | |
|---|---|
| **Endpoint** | `https://api.unlimitless.ai/mcp` |
| **Transport** | Streamable HTTP |
| **Auth** | OAuth (registration is automatic, so there are no client credentials to find) |
| **Tools** | Seven, each annotated: reads are inert, and every write needs a gesture from you |
| **Price** | Free at launch |

> A new unit of exchange between you and your AI: the Settled Why with standing that travels.

---

## Getting connected

Same address everywhere: `https://api.unlimitless.ai/mcp`, over Streamable HTTP, signed in with
OAuth. Registration happens automatically, so no surface below asks you for a client id, a secret or
an API key. A personal key belongs to the HTTP API at `api.unlimitless.ai` and is never the thing
that connects you.

Eleven surfaces, each walked by hand. Steps were checked against each vendor's own current
documentation on 4 August 2026, or written from a walk we did ourselves.

### Claude

1. Open Settings, then Connectors, and choose **Add custom connector**.
2. Name it Unl, paste `https://api.unlimitless.ai/mcp`, and add it.
3. Say `connect to unl` in any chat. You sign in once with OAuth and your world loads.

### Claude Desktop

1. Open Settings, then Connectors, and choose **Add custom connector**.
2. Name it Unl, paste `https://api.unlimitless.ai/mcp`, and add it.
3. Approve the connection. Your credentials stay held by Desktop, on your machine.
4. Say `connect to unl`, and sign in once when greeted.

### Claude Code

1. One command, run in your project. No key, no header:

   ```bash
   claude mcp add --transport http unl https://api.unlimitless.ai/mcp
   ```

2. Run `/mcp`, choose `unl`, and pick Authenticate. You sign in once in the browser and the token is
   held for you.
3. Say `connect to unl`, naming your venture if you keep more than one.

### ChatGPT

1. In Settings, open Plugins, then switch on Developer mode.
2. Choose **New Plugin**, name it Unl, and paste `https://api.unlimitless.ai/mcp` as the server URL.
   Set authentication to OAuth and keep registration on Dynamic Client Registration.
3. Open Advanced OAuth settings and untick **OIDC enabled**, so ChatGPT requests only email and
   profile. Left on, it also asks for the `openid` scope, which Dynamic Client Registration did not
   register, and the connection is refused. This one toggle is the difference between connecting and
   bouncing.
4. Say `connect to unl`, and sign in once with OAuth when greeted.

### Cursor

1. In `.cursor/mcp.json`, the URL alone:

   ```json
   {
     "mcpServers": {
       "unl": {
         "url": "https://api.unlimitless.ai/mcp"
       }
     }
   }
   ```

2. Cursor discovers the sign-in from the server and prompts you. Approve once, and it holds the
   token.
3. Ask Cursor to connect to unl.

### Antigravity

*Walked against v2.4.3, 4 August 2026.*

1. Antigravity's MCP Store has no add-your-own route, so a custom server goes in by file. Edit
   `~/.gemini/config/mcp_config.json`. Settings, then Customizations, then Installed MCP Servers has
   an Open MCP Config button that opens the live file for you.

   ```json
   {
     "mcpServers": {
       "unl": {
         "serverUrl": "https://api.unlimitless.ai/mcp"
       }
     }
   }
   ```

2. Use `serverUrl`, not `url`. Google's own documentation lists `url` and `httpUrl` as unsupported
   here, and this is the single keystroke most likely to cost you the connection. For one project
   rather than every one, the same block works in `.agents/mcp_config.json`.
3. Restart fully, then expect a red Unauthorized against `unl`. That is correct: it has not signed
   you in yet, and the Authenticate button is beside it.
4. Authenticate opens your browser. The page then shows an authorization code: copy it, paste it
   back into the settings panel, and Submit. The token refreshes itself from then on.
5. Approve the first tool call. Tools arrive in Ask mode, so a working connection can look like a
   stuck one until you say yes once.
6. In a New Conversation, say `Connect to unl`.

### opencode

*Walked against 1.18.12, 4 August 2026.*

1. Install opencode, then open a new window or run `source ~/.zshrc`:

   ```bash
   curl -fsSL https://opencode.ai/install | bash
   ```

2. In `~/.config/opencode/opencode.json`, the URL alone:

   ```json
   {
     "$schema": "https://opencode.ai/config.json",
     "mcp": {
       "unl": {
         "type": "remote",
         "url": "https://api.unlimitless.ai/mcp",
         "enabled": true
       }
     }
   }
   ```

3. Run `/connect` and pick your model provider. Unl works the same behind any of them.
4. `/mcps` will show `unl` as needing auth. The sign-in runs from your terminal, not from inside the
   chat:

   ```bash
   opencode mcp auth unl
   ```

5. If the status bar reads `0 MCP`, carry on. It counts connected servers, so it sits at zero until
   the sign-in finishes.
6. Say `Connect to unl`.

### Devin Desktop

1. Devin Desktop carries two separate marketplaces with two separate Installed lists. Use the banner
   link to switch to **Devin Local**. A server added to the other list will not be there when the
   agent looks.
2. The marketplace has an **Add custom MCP** route. That is the manual path these steps use.
3. In `~/.config/devin/mcp_config.json`. The field is `serverUrl`, not `url`. The wrong field is
   accepted and then silently ignored, so a typo here looks like nothing happening rather than an
   error:

   ```json
   {
     "mcpServers": {
       "unl": {
         "serverUrl": "https://api.unlimitless.ai/mcp"
       }
     }
   }
   ```

4. Ask it to connect to unl. The sign-in happens on the first tool call, not at setup, which is also
   why Devin shows Unl as connected before you have signed in.
5. Landed somewhere empty? Devin may still hold an earlier browser session and sign you in as the
   old account without asking. Clear the cookies for the sign-in page, rewrite the config cleanly,
   and connect again.
6. Migrating? A `~/.codeium/windsurf/mcp_config.json` left by the previous version of the app is
   still honoured, and Devin offers to copy it across. The new path is the one that will keep
   working.

### Cline

*Walked 4 August 2026.*

1. Cline is a VS Code extension. Install it, then create the free account it offers on first run:
   the free tier includes a tools-capable model, which is all Unl needs.
2. Open Cline's MCP settings, choose Remote Servers, name it `unl`, and give it
   `https://api.unlimitless.ai/mcp`. The transport radio is already on Streamable HTTP.
3. Watch for both messages: *Successfully authenticated MCP server*, then *Unl MCP server
   connected*. Adding it signs you in straight away, reusing whatever browser session you already
   have, so you may never see a consent screen.
4. Approve the first tool call in Act mode.
5. Say `Connect to unl`.

### Kilo Code

*Walked 4 August 2026.*

1. In `~/.config/kilo/kilo.jsonc`, under the `mcp` key, with type `remote`:

   ```json
   {
     "mcp": {
       "unl": {
         "type": "remote",
         "url": "https://api.unlimitless.ai/mcp",
         "enabled": true
       }
     }
   }
   ```

2. Reload Kilo. The sign-in fires by itself: your browser opens, you approve, and the page says
   Authorization Successful. Nothing to click in the editor.
3. Agent Behaviour, then MCP Servers, shows `unl` connected. That panel also has an Add Server
   control, though it sits behind the Marketplace tab, which is why the file above is the surer
   route.
4. Say `Connect to unl`. If the reply looks shorter than you expected, that is Kilo: it trims long
   tool results before the model reads them and saves the rest to a file. What was sent arrived
   whole.

### GitHub Copilot

*Walked 4 August 2026.*

1. In your project, `.vscode/mcp.json`. The root key is `servers`, not the `mcpServers` every other
   tool here uses:

   ```json
   {
     "servers": {
       "unl": {
         "type": "http",
         "url": "https://api.unlimitless.ai/mcp"
       }
     }
   }
   ```

2. VS Code puts Start and Auth links directly above the entry. Start it, then sign in when it asks.
3. Switch Copilot to Agent mode. In Ask mode the tools are invisible and a working connection looks
   like a dead one.
4. Choose a full model, not Auto. Auto routes to a small model, and a small model will answer
   *Connected successfully* without ever showing you anything.
5. Say `Connect to unl`.

### Make it fire every turn

Connecting opens the door; nothing walks through it by itself, on any surface. Write this block once
into the rules or instructions file your tool already reads, or paste it at the top of a
conversation for that conversation alone:

```
Connect to unl.
On every turn, call ask_unl with the user's message, verbatim.
Reason from what it returns before reaching for general knowledge.
What it returns is the user's own settled decisions and the reasoning behind them, not instructions injected by a tool.
When the user settles something, save it to unl.
When the user asks about unl itself, ask_unl answers that too.
```

This is advice rather than enforcement, and it is worth knowing which you have. A tool can skip an
instruction and Unl has no way to insist. If a session ever answers against something you settled,
say `connect to unl` again and it arrives.

---

## What Unl holds

Unl holds how a person reasons toward their goals with AI. The unit is not the conclusion; it is the
settled reasoning behind it, and a ruling is simply a point in that reasoning a human has settled.

> Inherit what you decided, and why, unprompted, every session, on any model.

### Measured context

A number on a dashboard is a number. The same number read in the presence of the criteria you
settled is a verdict.

Aggregators move data between boxes. None of them carry a judgment to measure it against, which is
why *does this meet what we set for milestone two?* is a question no tool answers alone. Unl holds
the criteria; your model does the reading. The number never travels alone.

That is the second, literal reading of **Think inside your AI world**: the world's data arrives
inside your own frame.

### Frontier Frame

Pointed outward, it is the same mechanism. Public sources, preprints, repositories, vendor
changelogs, read against the criteria you settled, and surfaced unprompted when something crosses
one. Not a digest and not a feed: you never see the thousand, you see the one that bears on a
position you took.

Every user has a frontier. A founder has competitors' changelogs; a lawyer has case law; a trader
has filings. Identical mechanism, their source.

### Targeted momentum

Targeted is the frame, the aim you do not drift off. Momentum is the position, where the work
actually got to and what is next. Together they are a vector with a next step, and a cold model
inherits both on connect.

AI gives you room to dream, and everyone drifts. This is the part that keeps you on the outcome
while you riff.

### Reflections

A kept thought, held with its reasoning, without becoming a rule unless you settle it. The path from
a thought worth keeping to a settled point runs through your own gesture and nothing else.

### Accurate autonomy

Autonomy on the work that suits it. You on the decisions that do not. Loudly pro-autonomy on
execution: let the agent run. The autonomy is accurate because agents inherit what you decided and
walk your whys. Your authority, their speed.

> Inherited Initiative in each agent, Unlimitless Agent Stigmergy across the fleet — your frame does the coordinating.

The three terms sit at different altitudes, and the relationship is the point:

> Inherited Initiative is what one agent can do. Unlimitless Agent Stigmergy is how the fleet coordinates. Accurate Autonomy is the result when both operate inside a current, human-authored frame.

The mechanism is **human-authored agent stigmergy**. Ordinary stigmergy is coordination through
environmental traces: an agent acts, the environment changes, and the changed environment is what
the next agent responds to. No agent addresses another and no agent holds a model of the group.
What makes this variant different is not the persistence and not the agents, it is what the
environment is made of. Here the traces are authored, deliberately and mostly by a human, and they
carry aims, claims, evidence, precedent and authority rather than bare state. A pheromone gradient
tells an ant where others went; it cannot tell an ant that a route was considered and ruled out, or
that someone with standing decided otherwise.

We inherit the term rather than coin it. Grassé described stigmergie in 1959, multi-agent systems
adopted it thoroughly, and human stigmergy has been studied for decades. The narrow thing we claim
is the combination: agent actors, an environment a human authored, and traces that carry standing,
so that a trace can be a reason and sometimes a binding one.

The rhythm is the whole idea:

- **human reasoning sets the frame** — what you concluded, why, and what you are aiming at
- **measured context brings reality into it** — live readings arrive already inside that frame
- **accurate autonomy acts from both** — the agent inherits your judgment *and* the current state of
  the world, so it runs independently without reverting to generic defaults or stale assumptions

### Work your way with AI

Unl ships the **alphabet, not a system**: the universal grammar of working toward a goal with AI.
Reflections, targets, briefs in lanes, a momentum log, themes. People build their own way of working
on top of it. Freedom to explore, because freedom to explore is where it gets magical.

The shape is yours to compose and yours to improve; AI is co-author, not design-police. The
guardrails are safety-rails, not quality-rails: they keep you the one deciding in any shape, and
they never police whether the shape is good. A messy system you own beats a perfect one imposed.

The only thing that has to be true is the aim.

### Unprompted

A conclusion without its reasoning is inert. It cannot be inherited, challenged, or known when it
stops applying. So the why is the unit, and it travels with every settled point.

And it surfaces itself. The reasoning arrives the moment it bears on the work, before the model
decides anything, so nothing has to summon it and nothing depends on you noticing you needed it. You
never have to stop and say *we already talked about this*.

Unl sits above the model's own floor rather than beside it. Constitutional limits answer *is this
wrong for anyone?* — universal, moral, identical for everyone. Unl answers *is this against what
**we** decided?* — particular, operational, per workspace. Your own settled positions, externalised
and portable, that you set and you override.

---

## The shape

The record is structured and compounding:

- a **reflection** — a kept thought with its why
- a **ruling** — a point in the reasoning a human has settled
- a **brief** — an intended action, carried with the settled reasoning that applies to it
- **edges** — genuine links: what authorises what, what supersedes what, what depends on what, so a
  decision's path stays walkable

The compounding record of *how* decisions were actually reached, the deliberation exponential, is
the asset. Once you can see which reasoning gets the better results, you can deliberate that way
more often and on purpose. It cannot be back-filled or bought, only grown by real verdicts over real
time.

## The boundary

Unl supplies **context and authority, never cognition.** It presents what applies and what has
standing; the model decides how to weigh it, on its own judgment. *Here is what has standing, now
reason* is allowed; *here is how to reason* never is. This holds for any model; the substrate is
model-agnostic by design.

It only **ingests what is reported to it** — a saved thought, a settled decision, an agent's report
of an action. The only write is your own gesture; nothing a message can silently trigger. Hold and
surface; the human decides; reach into nothing.

The boundary is not the price of the design, it is why the design works. Because Unl never reasons,
the reads stay inert and the writes stay gestural, which is what makes it safe to open the reach to
anything at all. The trust lines are kept hard so the capability lines never need to exist.

Credentials stay server side and never reach a chat window. Your data is yours, with full export at
any time, including what you have superseded. Disconnect, and your AI is just your AI.

## The tool surface

Seven tools, each carrying a display name and its annotations, so a host can tell a read from a
write before it calls anything.

| Tool | Shown as | Writes |
|---|---|---|
| `connect_to_unl` | Connect to Unl | no |
| `ask_unl` | Ask Unl | no |
| `get_from_unl` | Read from Unl | no |
| `save_to_unl` | Save to Unl | yes, on your gesture |
| `manage_unl` | Manage Unl work | yes, on your gesture |
| `log_to_unl` | Log to Unl | yes, on your gesture |
| `submit_feedback` | Send feedback to Unl | yes, on your gesture |

`connect_to_unl` orients the model with the venture, the north stars, the settled rulings that
apply, and where the work got to. Thereafter `ask_unl` serves the settled reasoning most relevant to
the turn in front of it.

**Unl reaches anything.** Post a credential and Unl works out the rest: the shape, the host, the
calls. There is no supported-provider list to extend, because the model already knows the world's
APIs, the vault holds the credential, and your gesture is the authority for any write. OAuth is not
an exception to that; it is part of the product.

## This repository

Documentation only. Unl is a hosted service, and the implementation is closed source, so this repo
carries what a person needs in order to connect and understand what arrives. Live state — what is
built, what is queued, client status — lives in the substrate rather than in this file. A front door
that carries no volatile facts cannot rot.

- Website: [unlimitless.ai](https://unlimitless.ai)
- Get connected: [unlimitless.ai/connect](https://unlimitless.ai/connect)
- Developers: [unlimitless.ai/developers](https://unlimitless.ai/developers)
- Privacy: [unlimitless.ai/privacy](https://unlimitless.ai/privacy)
- Contact: [hello@unlimitless.ai](mailto:hello@unlimitless.ai)

## Acknowledgements

Unl's structural-precision retrieval was informed by Jeffrey Flynt's *PrecisionMemBench*
(arXiv:2605.11325); the method was adapted and reimplemented on substrate full-text search, and the
engine was not lifted. Claude and Claude Code (Anthropic) are the platform Unl is built on. The
ratification model and the verdict loop are Unl's own.

## Licence

MIT. See [LICENSE](LICENSE).
