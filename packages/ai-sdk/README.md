# @unlimitless/ai-sdk

**Unl, your why agent, inside any [AI SDK](https://ai-sdk.dev) model.**

Your AI already knows how to reason. Unl gives it your reason. Unl keeps what you decided and why. Wrap a model once, and every call it makes carries the part of that reasoning that bears on the call, chosen by Agent Unl before your model thinks.

```bash
npm install @unlimitless/ai-sdk ai
export UNL_KEY=...   # a key from https://unlimitless.ai/portal/keys
```

```ts
import { generateText } from "ai";
import { withUnl } from "@unlimitless/ai-sdk";

const model = withUnl("openai/gpt-5");   // any AI SDK model: a gateway id, openai(...), anthropic(...)

const { text } = await generateText({
  model,
  prompt: "Should we add a queue for background jobs?",
});
```

That is the whole integration. Your model, tools, prompts and provider stay as they are. Unl adds one system message after your own, holding the decisions that bear on the call and the reasons behind them. When nothing bears, Unl adds nothing.

## Why a middleware

An agent can skip an optional tool. It cannot skip middleware. `withUnl` runs on every call, so the reach is part of how the model is built, not something the model has to remember to do.

It works alongside everything else you run. Unl never decides for you and never replaces your model, your tools or your memory layer. It only adds the person's why.

## Options

```ts
withUnl(model, {
  apiKey,          // default: process.env.UNL_KEY
  baseUrl,         // default: https://api.unlimitless.ai
  budgetBytes,     // cap on the served context; Unl keeps what bears most
  timeoutMs,       // default 4000; after this the call goes ahead without Unl
  onUnavailable,   // "continue" (default) or "throw"
  query,           // (prompt) => string: which text Unl reads. Default: the latest user message
  cacheMs,         // default 60000: tool-loop steps with the same query cost one Unl call
});
```

Compose it yourself with `unlMiddleware(options)` and `wrapLanguageModel`. Or call `serve(query)` directly for the raw window.

**If Unl cannot be reached, your call still runs.** It goes ahead without Unl and logs one warning. Set `onUnavailable: "throw"` if you would rather the call fail.

## What it sends

It sends one `POST https://api.unlimitless.ai/api/ask` per new query, carrying the latest user message, your model's id and your key. Nothing else from the conversation leaves your process. The key only reads. Agent Unl proposes new decisions only through the tools you choose to give your agent, and nothing is kept without your yes.

## Works with

This version was checked against `ai` 5, 6 and 7 (LanguageModel V2, V3 and V4). It works with every model provider the AI SDK supports, including the Vercel AI Gateway.

For agents that should also *propose* decisions and read the full reasoning behind them, add Unl's MCP tools as well: see [unlimitless.ai/developers](https://unlimitless.ai/developers#mcp).
