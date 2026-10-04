# Unl + AI SDK chat (Deploy with Vercel)

A Next.js chat on the Vercel AI Gateway. The model carries your why on every call: one line, `withUnl(model)`.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fneilmortimer-kar%2Funl-ai-sdk-chat&integration-ids=oac_TLalANC9cCnRMvZHKIq33VF7&project-name=unl-ai-sdk-chat)

> The button deploys the public repo `github.com/neilmortimer-kar/unl-ai-sdk-chat` and requires the Unl integration: add Unl when Vercel asks, sign in (or sign up) on unlimitless.ai, and Unl writes `UNL_KEY` into the new project. There is no key to copy.

## Before your first message

The chat calls its model through the Vercel AI Gateway, and the Gateway refuses every call until your Vercel team has a card on file. Add one in your team's AI Gateway settings, before or right after you deploy; it also unlocks the Gateway's free credits. Without it, the page tells you the call was refused and why.

## Run it locally

```bash
cp .env.example .env.local   # set UNL_KEY, and AI_GATEWAY_API_KEY outside Vercel
npm install
npm run dev
```

The integration is [`app/api/chat/route.ts`](app/api/chat/route.ts):

```ts
import { withUnl } from "@unlimitless/ai-sdk";
const model = withUnl("openai/gpt-5-mini");
```

Change `UNL_MODEL` to any AI Gateway model id. Your model, prompts and tools stay yours; Unl adds one system message holding the decisions that bear on the call, and nothing when none do.

Checked 4 Oct 2026: `next build` passes on Next 16.3.8 with `ai` 7.0.127.
